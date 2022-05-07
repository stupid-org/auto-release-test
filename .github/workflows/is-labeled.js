'use strict'

module.exports = async function isLabeled({ github, context, core }) {
  const pr = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.issue.number,
  });

  // console.log(JSON.stringify(pr))

  const targetLabels = ['semver-major', 'semver-minor', 'semver-patch', 'skip-release']
  const foundTargetLabels = []
  for (const label of pr.data.labels) {
    if (targetLabels.includes(label.name) === false) {
      continue
    }
    foundTargetLabels.push(label.name)
  }

  switch (foundTargetLabels.length) {
    case 0: {
      core.setFailed('No required labels found.')
      break
    }

    case 1: {
      break
    }

    default: {
      core.setFailed('Too many required labels found: ' + foundTargetLabels.join())
    }
  }
}
