Slack integration deployment
----------------------------

# app-builder-engine #

A prerequist of the Slack integration is the app-builder-engine.

The app-builder-engine consists of two parts:

  - A lambda application running on AWS
  - Configuration in the 4me account of the app provider

The app-builder-engine is a generic component that needs to be
installed only once per app provider (not per app offering).

To deploy the app-builder-engine, run
```
npm run bootstrap
```
This will (re)deploy the lambda application and configure the 4me account.


# Slack integration #

The Slack integration itself consists of three parts:

  - A lambda application running on AWS
  - A Slack App on slack.com
  - An App Offering in 4me

To deploy the Slack integration, run
```
npm run deploy-slack
```
This will (re)deploy the lambda application, the Slack App and the App Offering.

It will check the AWS secretsmanager for existing Slack App credentials in
4me-app-builder/slack/4me-staging.com/slack_app_credentials. When no
credentials are found, it will create a new Slack App. Otherwise it
will update the existing Slack App.

The Slack App is installed on slack.com under your Slack user account in your
Slack workspace, using a Slack App Configuration Token. You should generate such
a sort-lived token at https://api.slack.com/apps.

If the deployment created a new Slack App on slack.com, you should perform two
manual steps afterwards:

1. Upload a 4me icon for your Slack App
    - Go to https://api.slack.com/apps
    - Select your app
    - On Settings -> Basis Information, scroll down to Display Information
    - Click 'Add app icon'
    - Upload slack/images/4me-logo.png

2. Activate public distribution of your Slack App
    - Go to https://api.slack.com/apps
    - Select your app
    - On Setting -> Manage Distribution, click on Remove Hard Coded Information
    - Tick the box that you have removed any hard-coded information
    - At the bottom of the page, click Activate Public Distribution

If the deployment created a new App Offering in 4me, you should perform one manual step
afterwards:

1. Publish your App Offering
   - Open the App Offering in 4me (you can use the link that was displayed when
     `npm run deploy-slack` finished)
   - Click 'Publish'
