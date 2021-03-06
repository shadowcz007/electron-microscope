var crypto = require('crypto')
var path = require('path')
var electron = require('electron')
var through = require('through2')
var events = require('events')
var inherits = require('inherits')
var debug = require('debug')('electron-microscope')
var BrowserWindow = electron.BrowserWindow

module.exports = Microscope

function Microscope (opts, ready) {
  if (!(this instanceof Microscope)) return new Microscope(opts, ready)
  events.EventEmitter.call(this)
  var self = this
  if (typeof opts === 'function') {
    ready = opts
    opts = {}
  }
  this.opts = opts || {}
  this.window = new BrowserWindow({
    width: 800,
    height: 600,
    show: true
  })
  this.window.loadURL(path.join('file://', __dirname, 'window.html'))
  this.window.webContents.once('did-finish-load', function () {
    debug('did-finish-load window.html')
    ready(null, self)
  })
  this.window.webContents.once('did-fail-load', function (err) {
    debug('did-fail-load window.html', err)
    ready(err)
  })
  electron.ipcMain.on('webview-event', function (event, channel, data) {
    debug('webview-event', channel, data)
    self.emit(channel, data)
  })
}

inherits(Microscope, events.EventEmitter)

Microscope.prototype.loadURL = function (url, cb) {
  debug('start loadURL', url)
  this.window.send('load-url', url)
  if (cb) {
    electron.ipcMain.once('webview-did-finish-load', function (event, error) {
      debug('finish loadURL', url, error || '')
      cb(error)
    })
  }
}

Microscope.prototype.run = function (code) {
  if (typeof code === 'function') code = code.toString()
  var outStream = through()
  var id = crypto.randomBytes(16).toString('hex')
  this.window.send('run', id, code)
  electron.ipcMain.on(id + '-send-data', function (event, data) {
    outStream.push(data)
  })
  electron.ipcMain.once(id + '-done-running', function (event, err) {
    if (err) outStream.destroy(err)
    else outStream.end()
  })
  return outStream
}

Microscope.prototype.destroy = function () {
  this.window.close()
}
