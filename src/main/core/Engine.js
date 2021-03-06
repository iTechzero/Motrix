'use strict'

import { app } from 'electron'
import is from 'electron-is'
import { existsSync } from 'fs'
import { resolve, join } from 'path'
import forever from 'forever-monitor'
import logger from './Logger'
import { getEngineBin, getSessionPath, transformConfig } from '../utils/index'

export default class Engine {
  static instance = null

  constructor (options = {}) {
    this.systemConfig = options.systemConfig
    this.userConfig = options.userConfig
  }

  getStartSh () {
    const { platform } = process
    let basePath = resolve(app.getAppPath(), '..').replace(/(\s)/, '\\ ')
    logger.info('basePath===>', basePath)

    if (is.dev()) {
      basePath = resolve(__dirname, `../../../extra/${platform}`)
    }

    const binName = getEngineBin(platform)
    if (!binName) {
      throw new Error('引擎已损坏，请重新安装: (')
    }
    const binPath = join(basePath, `/engine/${binName}`)
    const confPath = join(basePath, '/engine/aria2.conf')

    let sessionPath = this.userConfig['session-path'] || getSessionPath()
    logger.info('sessionPath===>', sessionPath)
    let result = [`${binPath}`, `--conf-path=${confPath}`, `--save-session=${sessionPath}`]

    const sessionIsExist = existsSync(sessionPath)
    logger.info('sessionIsExist===>', sessionIsExist)

    if (sessionIsExist) {
      result = [...result, `--input-file=${sessionPath}`]
    }

    const extraConfig = transformConfig(this.systemConfig)
    result = [...result, ...extraConfig]

    return result
  }

  start () {
    const sh = this.getStartSh()
    logger.info('[Motrix] Engine start===>', sh)
    this.instance = forever.start(sh, {
      max: 3,
      silent: false // !is.dev()
    })

    logger.info('[Motrix] Engine pid===>', this.instance.child.pid)

    this.instance.on('exit:code', function (code) {
      logger.info(`[Motrix] Engine  has exited after 3 restarts===> ${code}`)
    })

    this.instance.on('error', (err) => {
      logger.info(`[Motrix] Engine  has exited after 3 restarts===> ${err}`)
    })
  }

  stop () {
    const { pid } = this.instance.child
    try {
      logger.info('[Motrix] Engine stopping===>')
      this.instance.stop()
      logger.info('[Motrix] Engine stopped===>', this.instance)
    } catch (err) {
      logger.error('[Motrix] Engine stop fail===>', err)
      this.forceStop(pid)
    } finally {
    }
  }

  forceStop (pid) {
    try {
      if (pid) {
        process.kill(pid)
      }
    } catch (err) {
      logger.warn('[Motrix] Engine forceStop fail===>', err)
    }
  }

  restart () {
    this.stop()
    this.start()
  }
}
