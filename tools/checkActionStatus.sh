#!/bin/bash

PROJECT_ID=17
ignore_repos=(
    "Seeed-Studio/wiki-documents"
    "Seeed-Studio/Hazard-Response-Mission-Pack"
    "Seeed-Studio/sync-github-all-issues"
)

function isIgnore() {
    for ignore in ${ignore_repos[*]}; do
        if [ $ignore == $1 ]; then
            return 1
        fi
    done

    return 0
}

function main() {
    repo_list=$(gh repo list Seeed-Studio --limit 1000 --json isPrivate,isArchived,nameWithOwner --jq '(.[] | select(.isArchived == false and .isPrivate == false)).nameWithOwner')

    cnt=1
    pr_flag=0
    for repo in $repo_list; do
        isIgnore $repo
        if [ $? -eq 1 ]; then
            echo " " && echo "ignore $repo"
            continue
        fi

        echo " " && echo "[$cnt] $repo - https://github.com/$repo"
        cnt=$((cnt + 1))

        disabled_id=$(gh workflow ls --repo $repo -a --json id,name,path,state --jq '(.[] | select(.path == ".github/workflows/stale.yml" and .state == "disabled_inactivity")).id')

        if [ "$disabled_id" ]; then
            echo "The action [$disabled_id] is in the disable state, start enabling"
            gh workflow enable $disabled_id --repo $repo
        fi
    done

    echo " " && echo "Summary"
}

main
