const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const org = process.env.ORG_NAME;
const projectNumber = process.env.PROJECT_NUMBER;
const columnName = process.env.COLUMN_NAME;

async function getProjectId() {
  const { data: projects } = await octokit.projects.listForOrg({
    org,
    state: "open",
  });

  const project = projects.find(p => p.number === parseInt(projectNumber));
  if (!project) throw new Error("Project not found");
  return project.id;
}

async function getColumnId(projectId) {
  const { data: columns } = await octokit.projects.listColumns({
    project_id: projectId,
  });

  const column = columns.find(c => c.name === columnName);
  if (!column) throw new Error("Column not found");
  return column.id;
}

async function getAllRepositories() {
  const repos = [];
  let page = 1;
  while (true) {
    const { data, headers } = await octokit.repos.listForOrg({
      org,
      type: "all",
      per_page: 100,
      page,
    });
    repos.push(...data);
    if (!headers.link || !headers.link.includes('rel="next"')) break;
    page++;
  }
  return repos;
}

async function getAllIssues(repos) {
  const issues = [];
  for (const repo of repos) {
    let page = 1;
    while (true) {
      const { data, headers } = await octokit.issues.listForRepo({
        owner: org,
        repo: repo.name,
        state: "all",
        per_page: 100,
        page,
      });
      issues.push(...data);
      if (!headers.link || !headers.link.includes('rel="next"')) break;
      page++;
    }
  }
  return issues;
}

async function addIssueToProject(issue, projectId, columnId) {
  try {
    await octokit.projects.createCard({
      column_id: columnId,
      content_id: issue.node_id, // Note: May need to adjust based on API
      content_type: 'Issue',
    });
    console.log(`Added Issue #${issue.number} to Project`);
  } catch (error) {
    if (error.status === 422) {
      console.log(`Issue #${issue.number} is already in the Project`);
    } else {
      console.error(`Failed to add Issue #${issue.number}:`, error);
    }
  }
}

(async () => {
  try {
    const projectId = await getProjectId();
    const columnId = await getColumnId(projectId);
    const repositories = await getAllRepositories();
    const issues = await getAllIssues(repositories);

    for (const issue of issues) {
      if (issue.pull_request) continue; // Skip pull requests
      await addIssueToProject(issue, projectId, columnId);
    }

    console.log("Sync completed successfully.");
  } catch (error) {
    console.error("Error during sync:", error);
    process.exit(1);
  }
})();