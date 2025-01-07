#!/bin/bash

stale_issue_message='This issue is stale because it has been open 14 days with no activity. Remove stale label or comment or this will be closed in 7 days.'
close_issue_message='This issue was closed because it has been stalled for 7 days with no activity.'
days_before_issue_stale=14
days_before_issue_close=7
label=Stale

function getTimeDiff() {
    expr $(date +%s) - $(date -d "$1" +%s)
}

function commentAndLabel() {
    is_labe_exist=$(gh label list --json name --jq "(.[] | select(.name == \"$label\")).name")
    if [ -z "$is_labe_exist" ]; then
        gh label create $label --color EDEDED
    fi

    gh issue comment $issue --body "$stale_issue_message"
    gh issue edit $issue --add-label "$label"
}

function commentAndClose() {
    gh issue comment $issue --body "$close_issue_message"
    gh issue close $issue -r "not planned"
}

function unLabel() {
    gh issue edit $issue --remove-label "$label"
}

function main() {
    time_before_issue_stale=$(expr 60 \* 60 \* 24 \* $days_before_issue_stale)
    time_before_issue_close=$(expr 60 \* 60 \* 24 \* $days_before_issue_close)
    issue_list=$(gh issue list --json number --jq '.[].number' --limit 1000)

    for issue in $issue_list; do
        echo " " && echo -e "\e[33mProcessing $issue\e[0m"

        is_stale=$(gh issue view $issue --json labels --jq "(.labels[] | select(.name == \"$label\")).name")
        last_comment=$(gh issue view "$issue" --json comments --jq '.comments[-1]')

        if [ -z "$last_comment" ]; then
            echo "No comments on this issue"

            create_time=$(gh issue view $issue --json createdAt --jq ".createdAt")
            dis_time=$(getTimeDiff $create_time)

            if [ "$dis_time" -gt "$time_before_issue_stale" ]; then
                commentAndLabel
            fi
            continue
        fi

        last_comment_time=$(echo "$last_comment" | jq -r '.createdAt')
        dis_time=$(getTimeDiff $last_comment_time)

        if [ "$is_stale" ]; then
            if [ "$dis_time" -gt "$time_before_issue_close" ]; then
                commentAndClose
                continue
            fi

            if [ "$last_comment_user" != "github-actions" ]; then
                unLabel
            fi
        else
            if [ "$dis_time" -gt "$time_before_issue_stale" ]; then
                commentAndLabel
            fi
        fi
    done
}

main
