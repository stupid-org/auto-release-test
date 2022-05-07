'use strict'

const { exec } = require('child_process')
const PackageJson = require('@npmcli/package-json')
const pacote = require('pacote')
const pack = require('libnpmpack')
const { publish } = require('libnpmpublish')
const semver = require('semver')

module.exports = async function issueRelease ({ github, context, core }) {
  const pr = await getPr({ github, context })
  if (pr.labels.some(label => label.name === 'skip-release') === true) {
    // Oof. If we do this, then we have to examine all PRs since the last release
    // to determine what the true semver qualification would be.
    core.notice('Not issuing release due to label: skip-release.')
    return
  }

  const semverQualification = getSemverQualification(pr)
  const pkg = await PackageJson.load('./')
  const newVersion = semver.inc(pkg.content.version, semverQualification)
  pkg.update({ version: newVersion })
  await pkg.save()

  core.info(`Updating package.json with new version: ${newVersion}`)
  await doCommand('git add package.json')
  await doCommand(`git commit -m v${newVersion}`)

  core.info(`Publishing new module version: ${newVersion}`)
  const manifest = await pacote.manifest('./')
  const tarData = await pack()
  // https://github.com/npm/cli/issues/4250#issuecomment-976602325
  await publish(manifest, tarData, {
    forceAuth: {
      token: process.env.NPM_TOKEN,
    },
    access: pkg?.publishConfig?.access ?? 'restricted'
  })

  core.info(`Commiting changes and creating new tag: v${newVersion}`)
  await doCommand('git push')
  await doCommand(`git tag v${newVersion}`)
  await doCommand('git push --tags')
}

async function getPr ({ github, context }) {
  const pr = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.issue.number,
  });

  if (pr.status !== 200) {
    throw Error(`Could not retrieve PR: ${pr.status}.`)
  }

  return pr.data
}

function getSemverQualification (pr) {
  const label = pr.labels.find(label => label.name.startsWith('semver-'))
  return label.name.replace('semver-', '')
}

async function doCommand (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
