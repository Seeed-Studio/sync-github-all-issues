import { Octokit } from "@octokit/rest";
import fetch from 'node-fetch';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch: fetch
  }
});

async function testOctokit() {
  try {
    const response = await octokit.repos.listForAuthenticatedUser();
    console.log('Success:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOctokit();