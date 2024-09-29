// sync-issues.js
import { graphql } from "@octokit/graphql";
import fetch from 'node-fetch';

// Initialize GraphQL client with authentication
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

// Environment Variables
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER, 10); // e.g., 17
const ORG_NAME = process.env.ORG_NAME; // e.g., 'Seeed-Studio'
const COLUMN_NAME = process.env.COLUMN_NAME; // e.g., 'To Do'

// Function to retrieve ProjectV2 ID based on project number
async function getProjectV2Id(org, projectNumber) {
  const query = `
    query ($org: String!, $projectNumber: Int!) {
      organization(login: $org) {
        projectsV2(first: 100, states: OPEN) {
          nodes {
            id
            number
            title
          }
        }
      }
    }
  `;

  const variables = {
    org,
    projectNumber,
  };

  try {
    const response = await graphqlWithAuth(query, variables);
    const projects = response.organization.projectsV2.nodes;
    const project = projects.find(p => p.number === projectNumber);

    if (!project) {
      throw new Error(`Project number ${projectNumber} not found in organization ${org}.`);
    }

    console.log(`📁 Found ProjectV2 ID: ${project.id} with title: "${project.title}"`);
    return project.id;
  } catch (error) {
    console.error(`Error fetching ProjectV2 for org ${org}:`, error);
    throw error;
  }
}

// Function to retrieve all repositories within the organization
async function listAllRepositories(org) {
  const query = `
    query ($org: String!, $after: String) {
      organization(login: $org) {
        repositories(first: 100, after: $after, isFork: false) {
          nodes {
            name
            owner {
              login
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const repositories = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const variables = { org, after };
    const response = await graphqlWithAuth(query, variables);
    const repos = response.organization.repositories.nodes;
    repositories.push(...repos);

    hasNextPage = response.organization.repositories.pageInfo.hasNextPage;
    after = response.organization.repositories.pageInfo.endCursor;
  }

  console.log(`📋 Found ${repositories.length} repositories in organization "${org}".`);
  return repositories;
}

// Function to retrieve all issues in a repository
async function listAllIssues(org, repo) {
  const query = `
    query ($org: String!, $repo: String!, $after: String) {
      repository(owner: $org, name: $repo) {
        issues(first: 100, after: $after, states: [OPEN, CLOSED]) {
          nodes {
            id
            number
            title
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const issues = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const variables = { org, repo, after };
    const response = await graphqlWithAuth(query, variables);
    const fetchedIssues = response.repository.issues.nodes;
    issues.push(...fetchedIssues);

    hasNextPage = response.repository.issues.pageInfo.hasNextPage;
    after = response.repository.issues.pageInfo.endCursor;
  }

  console.log(`📝 Found ${issues.length} issues in repository "${repo}".`);
  return issues;
}

// Function to add an issue to ProjectV2 as an item
async function addIssueToProjectV2(projectId, issueId) {
  const mutation = `
    mutation ($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item {
          id
          content {
            ... on Issue {
              number
              title
              url
            }
          }
        }
      }
    }
  `;

  const variables = {
    projectId,
    contentId: issueId,
  };

  try {
    const response = await graphqlWithAuth(mutation, variables);
    const item = response.addProjectV2ItemById.item;
    console.log(`✅ Added Issue #${item.content.number}: "${item.content.title}" to the Project.`);
  } catch (error) {
    if (error.message.includes("already exists")) {
      console.log(`ℹ️ Issue is already in the Project. Skipping.`);
    } else {
      console.error(`❌ Error adding issue to Project:`, error);
    }
  }
}

// Main synchronization function
async function syncIssuesToProject() {
  try {
    console.log(`🔄 Starting sync for organization: ${ORG_NAME}`);

    // Step 1: Get ProjectV2 ID
    const projectId = await getProjectV2Id(ORG_NAME, PROJECT_NUMBER);

    // Step 2: List all repositories in the organization
    const repositories = await listAllRepositories(ORG_NAME);

    // Step 3: Iterate through each repository and fetch issues
    for (const repo of repositories) {
      const { name: repoName, owner } = repo;
      console.log(`🔍 Processing repository: ${repoName}`);

      const issues = await listAllIssues(owner.login, repoName);

      for (const issue of issues) {
        try {
          await addIssueToProjectV2(projectId, issue.id);
        } catch (error) {
          console.error(`Error adding Issue #${issue.number} to Project:`, error);
        }
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