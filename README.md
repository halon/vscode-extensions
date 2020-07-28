# Halon extension for Visual Studio Code

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://docs.halon.io/go/vscodeplugin) with support for the [Halon Scripting Language](http://docs.halon.se/hsl).

**Note: This extension currently only works with the [componentized package](https://docs.halon.io/manual/comp.html) of the Halon MTA, not the [integrated package](https://docs.halon.io/manual/integrated.html).**

## Features

### Scripting
* Syntax highlighting
* Code completion
* Real-time linting

### Configuration
* YAML packer
* Blue-green testing
* Real-time linting

## Getting started

1. Create a new empty directory and open it in Visual Studio Code
2. Run the `Halon: Init` command to generate a configuration boilerplate
3. Edit the SSH settings in the `settings.json` file to point to your Halon installation
    * If you want to authenticate using a SSH key instead of a password you can replace the `password` key with `"agent": "$SSH_AUTH_SOCK"`
5. Run the `Halon: Build` command to generate the packaged YAML file(s)

## Commands

Press `Ctrl/Cmd` + `Shift` + `P` and then write `>Halon:` to see all available commands (or check the feature contributions).