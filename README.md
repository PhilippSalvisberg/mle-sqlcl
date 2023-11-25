# MLE command for SQLcl

## Introduction

The Oracle Database 23c supports MLE JavaScript modules. MLE modules are standard ECMAScript 2022 modules.

This repository provides an SQLcl custom command to load ECMAScript modules from an URL or file as MLE modules into an Oracle database.

This simplifies the installation of MLE modules by avoiding a detour via `BFILE` or `BLOB`.

## Using `mle.js` as SQLcl script

Download or fork this repository. Afterwards you can run `script <path-to-mle.js>/mle.js` to get the following usage help:

```
usage: script mle.js {subcommand} [options]

Valid subcommands and options are:

- install <moduleName> {<url>|<fileName>} [<version>]
  Installs an MLE module from a file or URL with an optional version of the module.

- register
  Registers 'mle' as a SQLcl command.

- help
  Shows this screen.

- version
  Print version and exit.
```

## Register `mle.js` as SQLcl Command `mle`

Download or fork this repository and add the folowing to your `login.sql` to permanantly add `mle` as a SQLcl command:

```
script (...)/mle-sqlcl/mle.js register
```

Afterwards you can type `mle` to get this usage help:

```
usage: mle {subcommand} [options]

Valid subcommands and options are:

- install <moduleName> {<url>|<fileName>} [<version>]
  Installs an MLE module from a file or URL with an optional version of the module.

- help
  Shows this screen.

- version
  Print version and exit.
```

## License

Licensed under the Apache License, Version 2.0. You may obtain a copy of the License at <http://www.apache.org/licenses/LICENSE-2.0>.
