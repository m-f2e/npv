#!/usr/bin/env node

const { program } = require('commander')
const inquirer = require('inquirer');
const { exec, execSync } = require('child_process')
const ping = require('node-http-ping')
const fs = require('fs')
const chalk = require("chalk");
const path = require('path')
const registries = require('../registries.json');
const { version } = require('../package.json')

// 设置版本号
program.version(version)

// 白名单列表
const whiteList = [ 'npm', 'yarn', 'tencent', 'cnpm', 'taobao', 'npmMirror' ]

// 获取npm仓库列表
const getOrigin = async () => {
  return await execSync('npm config get registry', { encoding: 'utf-8' })
}

// 删除url最后一个字符/
const del = (url) => {
  const arr = url.split('')
  return arr[arr.length - 1] == '/' ? (arr.pop() && arr.join('')) : arr.join('')
}

// cli 命令
/// ls
program.command('ls').description('查看镜像列表').action(async () => {
  const res = await getOrigin()
  const keys = Object.keys(registries)
  const message = []
  // 查找镜像名称中最大长度 + 3
  const max = Math.max(...keys.map(v => v.length)) + 3
  keys.forEach((key, index) => {
    // 找到当前环境中的镜像
    const newK = registries[key].registry === res.trim() ? '* ' + key : '  ' + key
    const Arr = new Array(...newK)
    Arr.length = max
    const prefix = Array.from(Arr).map(v => v ? v : '-').join('')
    message.push(prefix + ' ' + registries[key].registry)
  })
  console.log(message.join('\n'))
})

/// use选择镜像
program.command('use').description('选择镜像').action(async () => {
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'sel',
      message: '请选择镜像',
      choices: Object.keys(registries)
    }
  ])
  const reg = registries[result.sel].registry
  exec(`npm config set registry ${reg}`, null, (err, stdout, stderr) => {
    if (err) {
      console.log(chalk.red('切换错误' + err))
    } else {
      console.log(chalk.green('切换成功'))
    }
  })
})

/// 查看当前镜像源
program.command('current').description('查看当前镜像源').action(async () => {
  const reg = await getOrigin()
  const keys = Object.keys(registries)
  const v = keys.find(v => {
    if (registries[v].registry === reg.trim()) {
      return v
    }
  })
  console.log(chalk.green('当前镜像源:' + v ? v : reg))
})

/// 自定义镜像源
program.command('add').description('自定义镜像源').action(async () => {
  const result = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '请输入镜像源名称',
      validate: (answer) => {
        const keys = Object.keys(registries)
        if (keys.includes(answer)) {
          return '该镜像源已存在'
        }
        if (!answer.trim()) {
          return '镜像源名称不能为空'
        }
        return true
      },
    },
    {
      type: 'input',
      name: 'url',
      message: '请输入镜像源地址',
      validate: (answer) => {
        if (!answer.trim()) {
          return '镜像源地址不能为空'
        }
        return true
      },
    }
  ])
  registries[result.name] = {
    home: result.url.trim(),
    registry: result.url.trim(),
    ping: del(result.url),
  }
  try {
    fs.writeFileSync(path.resolve(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))
    console.log(chalk.blue('添加完成'))
  } catch (error) {
    console.log(chalk.red(error))
  }
})

/// 删除自定义镜像源
program.command('delete').description('删除自定义镜像源').action(async () => {
  const keys = Object.keys(registries)
  if (keys.length === whiteList.length) {
    console.log(chalk.red('当前无自定义源可以删除'))
    return
  }
  const diff = keys.filter(v => !whiteList.includes(v))
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'sel',
      message: '请选择要删除的镜像源',
      choices: diff
    }
  ])
  const current = await getOrigin()
  const selOrigin = registries[result.sel].registry
  if (current.trim() === selOrigin.trim()) {
    console.log(chalk.red(`当前还在使用该镜像${selOrigin}`))
    return
  }
  try {
    delete registries[result.sel]
    fs.writeFileSync(path.resolve(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))
    console.log(chalk.green('删除成功'))
  } catch (error) {
    console.log(chalk.red(error))
  }
})

/// 重命名自定义镜像源
program.command('rename').description('重命名自定义镜像源').action(async () => {
  const keys = Object.keys(registries)
  if (keys.length === whiteList.length) {
    console.log(chalk.red('当前无自定义源可以重命名'))
    return
  }
  const diff = keys.filter(v => !whiteList.includes(v))
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'sel',
      message: '请选择要重命名的镜像源',
      choices: diff
    },
    {
      type: 'input',
      name: 'rename',
      message: '请输入新的镜像源名称',
      validate: (answer) => {
        const keys = Object.keys(registries)
        if (keys.includes(answer)) {
          return '该镜像源已存在'
        }
        if (!answer.trim()) {
          return '镜像源名称不能为空'
        }
        return true
      },
    }
  ])
  // @ts-ignore
  registries[result.rename] = Object.assign({}, registries[result.sel])
  // @ts-ignore
  delete registries[result.sel]

  try {
    fs.writeFileSync(path.resolve(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))
    console.log(chalk.green('重命名成功'))
  } catch (error) {
    console.log(chalk.red(error))
  }
})

/// 编辑自定义源
program.command('edit').description('编辑自定义源').action(async () => {
  const keys = Object.keys(registries)
  if (keys.length === whiteList.length) {
    console.log(chalk.red('当前无自定义源可以编辑'))
    return
  }
  const diff = keys.filter(v => !whiteList.includes(v))
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'sel',
      message: '请选择要编辑的镜像源',
      choices: diff
    },
    {
      type: 'input',
      name: 'registerUrl',
      message: '请输入新的镜像源地址',
      validate: (answer) => {
        if (!answer.trim()) {
          return '镜像源地址不能为空'
        }
        return true
      },
    }
  ])
  registries[result.sel] = {
    home: result.registerUrl.trim(),
    registry: result.registerUrl.trim(),
    ping: del(result.registerUrl),
  }
  try {
    fs.writeFileSync(path.resolve(__dirname, '../registries.json'), JSON.stringify(registries, null, 4))
    console.log(chalk.green('修改成功'))
  } catch (error) {
    console.log(chalk.red(error))
  }
})

/// 实现ping功能
program.command('ping').description('实现ping功能').action(async () => {
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'sel',
      message: '请选择镜像',
      choices: Object.keys(registries)
    }
  ])
  const pingUrl = registries[result.sel].ping.trim()
  try {
    const time = await ping(pingUrl)
    console.log(chalk.blue(`响应时长: ${time}ms`))
  } catch (error) {
    console.log(chalk.red('GG', 'timeout'))
  }
})

program.parse(process.argv)