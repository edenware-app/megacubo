// safe wrapper around fs.createReadStream to prevent fatal errors when file is deleted before opening

const fs = require('fs'), path = require('path')
const { Readable } = require('stream')

class Reader extends Readable {
	constructor(file, opts = {}) {
		super(opts)
		this.file = file
		this.opts = opts
		this.fd = null
		this.bytesRead = 0
		this.bufferSize = opts.highWaterMark || 64 * 1024 // Tamanho do buffer padrão (64 KB)
		if(!this.file) throw 'Reader initialized with no file specified'
		process.nextTick(() => this.openFile())
	}
	_read(size) {
		if (this.isPaused()) {
			return this.once('resume', () => this._read(size))
		}
		if (this.fd === null) {
			return this.once('open', () => this._read(size))
		}
		const remainingBytes = this.end !== undefined ? this.end - this.bytesRead : undefined
		if (this.end !== undefined && remainingBytes <= 0) {
			this.close()
			this.push(null)
			return
		}
		const bufferSize = Math.min(size || this.bufferSize, remainingBytes || this.bufferSize)
		const buffer = Buffer.alloc(bufferSize)
		const position = this.start + this.bytesRead
		fs.read(this.fd, buffer, 0, bufferSize, position, (err, bytesRead) => {
			if (err) {
				console.error('READER ERROR: '+ err)
				this.emit('error', err)
				this.destroy()
			} else if (bytesRead > 0) {
				this.bytesRead += bytesRead
				this.push(buffer.slice(0, bytesRead))
			} else {
				if(this.opts.persistent === true) {
					setTimeout(() => {
						this._read(size)
					}, 1000)
				} else {
					this.close()
					this.push(null)
				}
			}
		})
	}
	openFile() {
		try {
			fs.access(this.file, fs.constants.R_OK, (err) => {
				if (err) {
					console.error('Failed to access file:', err)
					this.emit('error', err)
					this.destroy()
				} else {
					fs.open(this.file, 'r', (err, fd) => {
						if (err) {
							console.error('Failed to open file:', err)
							this.emit('error', err)
							this.destroy()
						} else {
							this.fd = fd
							this.emit('open')
						}
					})
				}
			})
		} catch (err) {
			console.error('Error opening file:', err)
			this.emit('error', err)
			this.destroy()
		}
	}
	endPersistence() {
		this.opts.persistent = false
	}
	close() {
		if (this.fd !== null) {
			fs.close(this.fd, (err) => {
				if (err) {
					console.error('Failed to close Reader file descriptor: '+err)
				}
			})
			this.fd = null
		}
		if(!this.closed) {			
			this.closed = true
			this.emit('finish')
			this.emit('close')
			this.destroy()
		}
	}
}

module.exports = Reader
