#!/bin/bash

PROJECT_ID=17
PR_LOG_FILE=pr.log
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

function createLabel() {
    label_list=$(gh label list --repo $repo --json name --jq ".[].name")

    if [[ ! $label_list =~ "$repo_name" ]]; then
        gh label create $repo_name --repo $repo --description "Label for $repo_name" --color 8DC21F
    fi

    if [[ ! $label_list =~ "Pull request" ]]; then
        gh label create "Pull request" --repo $repo --description "Label for pull requests" --color 800080
    fi

    if [[ ! $label_list =~ "UAY" ]]; then
        gh label create "UAY" --repo $repo --description "Label for UAY" --color FFFFFF
    fi
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

        echo " " && echo "[$cnt] $repo"
        cnt=$((cnt + 1))
        org=$(echo $repo | awk -F/ '{print $1}')
        repo_name=$(echo $repo | awk -F/ '{print $2}')

        pr_list=$(gh pr list --repo $repo --json url,projectItems --jq '(.[] | select(isempty(.projectItems[]))).url')
        for pr in $pr_list; do
            echo -e "\e[33mProcessing $pr\e[0m"
            flag=0
            pr_flag=1

            createLabel

            gh pr edit "$pr" --add-label "$repo_name,Pull request,UAY" >/dev/null
            if [ $? -eq 0 ]; then
                echo -e "\e[32mLabel add successful\e[0m"
            else
                flag=1
                echo -e "\e[31mLabel add failed\e[0m"
            fi

            gh project item-add $PROJECT_ID --owner $org --url "$pr" >/dev/null
            if [ $? -eq 0 ]; then
                echo -e "\e[32mAdd Pr to Project successful\e[0m"
            else
                flag=1
                echo -e "\e[31mAdd Pr to Project failed\e[0m"
            fi

            if [ $flag -eq 0 ]; then
                echo -e "\e[32mAdd Pr($pr) to Project successful\e[0m" >> $PR_LOG_FILE
            else
                echo -e "\e[31mAdd Pr($pr) to Project failed\e[0m" >> $PR_LOG_FILE
            fi
        done
    done

    echo " " && echo "Summary"
    if [ $pr_flag -eq 1 ]; then
        cat $PR_LOG_FILE
    else
        echo -e "\e[32mNo PRs to be processed\e[0m"
    fi
}

main
