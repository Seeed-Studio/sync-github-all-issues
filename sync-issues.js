// sync-issues.js
import { Octokit } from "@octokit/rest";
import fetch from 'node-fetch';

// Initialize Octokit with authentication and node-fetch
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: {
    fetch,
  },
});

// Environment Variables
const PROJECT_NUMBER = process.env.PROJECT_NUMBER; // e.g., '17'
const ORG_NAME = process.env.ORG_NAME; // e.g., 'Seeed-Studio'
const COLUMN_NAME = process.env.COLUMN_NAME; // e.g., 'To Do'

// Function to retrieve the Project ID based on PROJECT_NUMBER
async function getProjectId(org, projectNumber) {
  try {
    const response = await octokit.rest.projects.listForOrg({
      org,
      state: 'open',
      per_page: 100,
    });

    const project = response.data.find(proj => proj.number === parseInt(projectNumber, 10));
    if (!project) {
      throw new Error(`Project number ${projectNumber} not found in organization ${org}.`);
    }

    return project.id;
  } catch (error) {
    console.error(`Error fetching projects for org ${org}:`, error);
    throw error;
  }
}

// Function to retrieve the Column ID based on COLUMN_NAME
async function getColumnId(projectId, columnName) {
  try {
    const response = await octokit.rest.projects.listColumns({
      project_id: projectId,
      per_page: 100,
    });

    const column = response.data.find(col => col.name === columnName);
    if (!column) {
      throw new Error(`Column "${columnName}" not found in project ID ${projectId}.`);
    }

    return column.id;
  } catch (error) {
    console.error(`Error fetching columns for project ID ${projectId}:`, error);
    throw error;
  }
}

// Function to list all repositories within the organization
async function listAllRepositories(org) {
  try {
    const repos = [];
    let page = 1;
    const per_page = 100;
    while (true) {
      const response = await octokit.rest.repos.listForOrg({
        org,
        type: 'all',
        per_page,
        page,
      });
      repos.push(...response.data);
      if (response.data.length < per_page) break;
      page += 1;
    }
    return repos;
  } catch (error) {
    console.error(`Error listing repositories for org ${org}:`, error);
    throw error;
  }
}

// Function to list all issues in a specific repository
async function listAllIssues(owner, repo) {
  try {
    const issues = [];
    let page = 1;
    const per_page = 100;
    while (true) {
      const response = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page,
        page,
      });
      // Exclude pull requests
      const repoIssues = response.data.filter(issue => !issue.pull_request);
      issues.push(...repoIssues);
      if (response.data.length < per_page) break;
      page += 1;
    }
    return issues;
  } catch (error) {
    console.error(`Error listing issues for repo ${owner}/${repo}:`, error);
    throw error;
  }
}

// Function to add an issue to the specified Project column
async function addIssueToColumn(columnId, issue) {
  try {
    await octokit.rest.projects.createCard({
      column_id: columnId,
      content_id: issue.id, // Use the issue's database ID
      content_type: 'Issue',
    });
    console.log(`✅ Added Issue #${issue.number}: "${issue.title}" to column.`);
  } catch (error) {
    if (error.status === 422) {
      console.log(`ℹ️ Issue #${issue.number}: "${issue.title}" is already in the project. Skipping.`);
    } else {
      console.error(`❌ Error adding Issue #${issue.number}: "${issue.title}" -`, error.message);
    }
  }
}

// Main function to orchestrate the synchronization
async function syncIssuesToProject() {
  try {
    console.log(`🔄 Starting sync for organization: ${ORG_NAME}`);

    // Retrieve Project ID
    const projectId = await getProjectId(ORG_NAME, PROJECT_NUMBER);
    console.log(`📁 Found Project ID: ${projectId}`);

    // Retrieve Column ID
    const columnId = await getColumnId(projectId, COLUMN_NAME);
    console.log(`📂 Found Column ID: ${columnId}`);

    // Retrieve all repositories in the organization
    console.log(`📦 Listing all repositories in organization "${ORG_NAME}"...`);
    const repos = await listAllRepositories(ORG_NAME);
    console.log(`📋 Found ${repos.length} repositories.`);

    // Iterate through each repository and its issues
    for (const repo of repos) {
      const { name: repoName, owner } = repo;
      console.log(`🔍 Processing repository: ${repoName}`);

      // List all issues in the repository
      const issues = await listAllIssues(owner.login, repoName);
      console.log(`📝 Found ${issues.length} issues in ${repoName}.`);

      for (const issue of issues) {
        // Add the issue to the specified Project column
        await addIssueToColumn(columnId, issue);
      }
    }

    console.log('✅ Sync completed successfully.');
  } catch (error) {
    console.error('❌ An error occurred during synchronization:', error);
    process.exit(1);
  }
}

// Execute the synchronization
syncIssuesToProject();