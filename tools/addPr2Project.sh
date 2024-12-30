#!/bin/bash

repo=$GITHUB_REPOSITORY
org=$(echo $repo | awk -F/ '{print $1}')
repo_name=$(echo $repo | awk -F/ '{print $2}')

createLabel() {
    label_list=$(gh label list --repo $repo --json name --jq ".[].name")

    if [[ ! $label_list =~ "$repo_name" ]]; then
        gh label create $repo_name --description "Label for $repo_name" --color 8DC21F
    fi

    if [[ ! $label_list =~ "Pull request" ]]; then
        gh label create "Pull request" --description "Label for pull requests" --color 800080
    fi

    if [[ ! $label_list =~ "UAY" ]]; then
        gh label create "UAY" --description "Label for UAY" --color FFFFFF
    fi
}

main() {
    createLabel

    gh pr edit "$URL" --add-label "$repo_name,Pull request,UAY"
    gh project item-add $PROJECT_ID --owner $org --url "$URL"

    echo "Add current PR to project successfully"
}

main
