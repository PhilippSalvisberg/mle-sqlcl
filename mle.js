/*
* Copyright 2023 Philipp Salvisberg <philipp.salvisberg@gmail.com>
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

"use strict";

// SQLcl uses the Nashorn JS engine of the JDK 11 by default.
// As a result, this JS file must comply with ECMAScript 5.1.

var javaSQLCommand = Java.type("oracle.dbtools.raptor.newscriptrunner.SQLCommand");
var javaCommandRegistry = Java.type("oracle.dbtools.raptor.newscriptrunner.CommandRegistry");
var javaCommandListener = Java.type("oracle.dbtools.raptor.newscriptrunner.CommandListener");

var getVersion = function() {
    return "1.0.0-SNAPSHOT";
}

var printVersion = function() {
    ctx.write("MLE version " + getVersion() + "\n\n");
}

var printUsage = function (asCommand) {
    printVersion();
    if (asCommand) {
        ctx.write("usage: mle {subcommand} [options]\n\n");
    } else {
        ctx.write("usage: script mle.js {subcommand} [options]\n\n");
    }
    ctx.write("Valid subcommands and options are:\n\n");
    ctx.write("- install <moduleName> {<url>|<fileName>} [<version>]\n");
    ctx.write("  Installs an MLE module from a file or URL.\n\n");
    if (!asCommand) {
        ctx.write("- register\n");
        ctx.write("  Registers 'mle' as a SQLcl command.\n\n");
    }
    ctx.write("- help\n");
    ctx.write("  Shows this screen.\n\n");
    ctx.write("- version\n");
    ctx.write("  Print version and exit.\n\n");
}

var install = function (options) {
    var script = "set scan off" + "\n"
        + "create or replace mle module "
        + options.moduleName
        + " language javascript";
    if (options.version != null) {
        script = script 
        + " version '" 
        + options.version
        + "'";
    }
    script = script 
        + " as " + "\n"
        + options.content + "\n"
        + "/" + "\n";
    sqlcl.setStmt(script);
    sqlcl.run();
}

var processAndValidateArgs = function (args) {
    var moduleName = null;
    var content = null;
    var version = null;
    var result = function (valid) {
        return {
            moduleName: moduleName,
            content: content,
            version: version,
            valid: valid
        };
    }
    if (args.length < 2) {
        ctx.write("missing mandatory subcommand.\n\n");
        return result(false);
    }
    if (args[1].toLowerCase() !== "install") {
        ctx.write("unknown subcommand '" + args[1] + "'.\n\n");
        return result(false);
    }
    if (args.length < 3) {
        ctx.write("missing mandatory <moduleName>.\n\n");
        return result(false);
    }
    moduleName = args[2];
    if (args.length < 4) {
        ctx.write("missing mandatory <url> or <fileName>.\n\n");
        return result(false);
    }
    try {
        // assume 3rd parameter is an URL
        var url = new java.net.URL(args[3]);
        content = new java.lang.String(url.openStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    } catch (e1) {
        try {
            // assume 3rd parameter is a file
            var path = java.nio.file.Path.of(args[3]);
            content = java.nio.file.Files.readString(path);
        } catch (e2) {
            ctx.write("cannot get content of '" + args[3] + "'.\n\n");
            return result(false);
        }
    }
    if (args.length == 5) {
        version = args[4];
    }
    if (args.length > 5) {
        ctx.write("too many parameters passed.\n\n");
        return result(false);
    }
    return result(true);
}

var run = function (args) {
    var asCommand = args[0].toLowerCase() === "mle";
    ctx.write("\n");
    if (args.length === 2 && (args[1].toLowerCase() === "help")) {
        printUsage(asCommand);
    } else if (args.length == 2 && (args[1].toLowerCase() === "version")) {
        printVersion();
    } else {
        var options = processAndValidateArgs(args);
        if (!options.valid) {
            printUsage(asCommand);
        } else {
            install(options);
        }
    }
}

var getArgs = function (cmdLine) {
    var p = java.util.regex.Pattern.compile('("([^"]*)")|([^ ]+)');
    var m = p.matcher(cmdLine.trim());
    var args = [];
    while (m.find()) {
        args.push(m.group(3) != null ? m.group(3) : m.group(2));
    }
    return args;
}

var unregisterMle = function () {
    var listeners = javaCommandRegistry.getListeners(ctx.getBaseConnection(), ctx).get(javaSQLCommand.StmtSubType.G_S_FORALLSTMTS_STMTSUBTYPE);
    // remove all commands registered with javaCommandRegistry.addForAllStmtsListener
    javaCommandRegistry.removeListener(javaSQLCommand.StmtSubType.G_S_FORALLSTMTS_STMTSUBTYPE);
    javaCommandRegistry.clearCaches(ctx.getBaseConnection(), ctx);
    var remainingListeners = javaCommandRegistry.getListeners(ctx.getBaseConnection(), ctx).get(javaSQLCommand.StmtSubType.G_S_FORALLSTMTS_STMTSUBTYPE)
        .stream().map(function(l) {return l.getClass()}).collect(java.util.stream.Collectors.toSet());
    // re-register all commands except for class Mle and remaining (not removed) listener classes
    for (var i in listeners) {
        if (listeners.get(i).toString() !== "Mle" && !remainingListeners.contains(listeners.get(i).getClass())) {
            javaCommandRegistry.addForAllStmtsListener(listeners.get(i).getClass());
        }
    }
}

var registerMle = function () {
    var handleEvent = function (conn, ctx, cmd) {
        var args = getArgs(cmd.getSql());
        if (args != null && typeof args[0] != "undefined" && args[0].toLowerCase() === "mle") {
            run(args);
            return true;
        }
        return false;
    }
    var beginEvent = function (conn, ctx, cmd) {}
    var endEvent = function (conn, ctx, cmd) {}
    var toString = function () {
        // to identify this dynamically created class during unregisterMle()
        return "Mle";
    }
    var Mle = Java.extend(javaCommandListener, {
        handleEvent: handleEvent,
        beginEvent: beginEvent,
        endEvent: endEvent,
        toString: toString
    });
    unregisterMle();
    javaCommandRegistry.addForAllStmtsListener(Mle.class);
    ctx.write("\nmle registered as SQLcl command.\n\n");
}

// main
if (args.length >= 2 && (args[1].toLowerCase() === "register")) {
    registerMle();
} else {
    run(args);
}
