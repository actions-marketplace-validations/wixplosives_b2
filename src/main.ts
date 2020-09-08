import * as core from '@actions/core'
import {Octokit} from '@octokit/action'

export function parsePullRequestNumFromUrl(url: string): number {
  const parts = url.split('/')
  if (parts.length > 1 && !isNaN(+parts[parts.length - 1])) {
    const pull_request_num = Number(parts[parts.length - 1])
    return pull_request_num
  } else {
    throw new Error('Bad pull request format')
  }
}

async function getBranchName(
  repo_owner: string,
  repo_name: string,
  pull_request_url: string
): Promise<string> {
  const pull_request_num = parsePullRequestNumFromUrl(pull_request_url)
  const octokit = new Octokit()
  const commandUrl = 'GET /repos/:owner/:repo/pulls/:pull_number'
  const commandParams = {
    owner: repo_owner,
    repo: repo_name,
    pull_number: pull_request_num
  }
  const retval = await octokit.request(commandUrl, commandParams)

  return Promise.resolve(retval.data.head.ref)
}

export function getCommand(comment: string): string {
  const keyPhrase = '@core3-ci-'
  if (comment.startsWith(keyPhrase)) {
    const words = comment.split(' ')
    const firstPart = words[0]
    const command = firstPart.slice(keyPhrase.length, firstPart.length)
    return command
  }
  return ''
}

async function run(): Promise<void> {
  try {
    const dryrun: string = core.getInput('dryrun')
    const commentText: string = core.getInput('commentText')
    const refParam: string = core.getInput('ref')
    const repo: string = core.getInput('repo')
    const pull_request: string = core.getInput('pull_request_link')
    const comment_id: string = core.getInput('issue_comment_id')

    let branch_ref = refParam
    if (pull_request !== '') {
      const repo_stub_parts = repo.split('/')
      branch_ref = await getBranchName(
        repo_stub_parts[0],
        repo_stub_parts[1],
        pull_request
      )
    }
    core.info(
      `Executing. comment: ${commentText} repo:${repo}, pull_request_link: ${pull_request}, issue comment id: ${comment_id}`
    )
    const command = getCommand(commentText)
    if (command !== '') {
      const commandUrl =
        'POST /repos/:repository/actions/workflows/:workflow_id/dispatches'
      const commandParams = {
        ref: branch_ref,
        repository: repo,
        workflow_id: `${command}.yaml`,
        inputs: {
          issue_comment_id: comment_id
        }
      }
      core.info(
        `Found @measure command. repo: ${repo}. ref: ${commandParams.ref}`
      ) // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
      if (dryrun === 'true') {
        const paramsString = JSON.stringify(commandParams)
        core.info(`Octokit dryrun. url: ${commandUrl} params: ${paramsString}`)
      } else {
        const octokit = new Octokit()
        await octokit.request(commandUrl, commandParams)
      }
    }
    core.setOutput('Exiting', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
