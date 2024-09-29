import { Octokit } from "@octokit/rest";
import fetch from 'node-fetch';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch }
});

const org = process.env.ORG_NAME;

async function getAllProjects() {
  let page = 1;
  let allProjects = [];
  let hasNextPage = true;
  
  while (hasNextPage) {
    const response = await octokit.projects.listForOrg({
      org,
      state: "all",  // Consider all projects regardless of their state
      per_page: 100,
      page
    });
    allProjects.push(...response.data);
    console.log(`Projects on page ${page}:`, JSON.stringify(response.data.map(p => ({ number: p.number, state: p.state })), null, 2));
    page++;
    hasNextPage = response.data.length === 100;
  }

  return allProjects;
}

async function findProjectByNumber(projectNumber) {
  const projects = await getAllProjects();
  const project = projects.find(p => p.number === parseInt(projectNumber, 10));
  if (!project) {
    console.error(`No matching project found for number ${projectNumber}.`);
    throw new Error("Project not found");
  }
  console.log(`Found project: ${JSON.stringify(project, null, 2)}`);
  return project.id;
}

(async () => {
  try {
    console.log("Starting synchronization process...");
    const projectNumber = process.env.PROJECT_NUMBER; // Ensure this is just the number, e.g., '17'
    const projectId = await findProjectByNumber(projectNumber);
    console.log(`Project ID: ${projectId}`);
    console.log("Synchronization completed successfully.");
  } catch (error) {
    console.error("Error during synchronization:", error);
    process.exit(1);
  }
})();