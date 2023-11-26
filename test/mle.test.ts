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

import { beforeAll, afterAll, describe, it, expect, beforeEach } from "vitest";
import { createSessions, closeSessions, mleSession, mleConfig } from "./dbconfig";
import { exec } from "child_process";
import util from "node:util";
import tempfile from "tempfile";
import {writeFileSync} from 'fs';

describe("SQLcl script mle.js", () => {
    const timeout = 15000;

    async function runSqlcl(script: string): Promise<{stdout: string; stderr: string;}> {
        const file = tempfile({extension: 'sql'});
        writeFileSync(file, `${script + '\n'}exit;`);
        const execAsync = util.promisify(exec);
        const result = await execAsync(
            `sql -S ${mleConfig.user}/${mleConfig.password}@${mleConfig.connectString} @${file}`
        );
        return result;
    }

    beforeAll(async () => {
        await createSessions();
    }, timeout);

    beforeEach(async () => {
        mleSession.execute("drop mle module if exists sql_assert_mod");
        mleSession.execute("drop mle module if exists util_mod");
        mleSession.execute("drop function if exists simple_sql_name");
        mleSession.execute("drop function if exists to_epoch");
    })

    describe("install mle module from url", () => {
        it("should install sql-assert without version number)", async () => {
            const actual = await runSqlcl("script mle.js install sql_assert_mod https://esm.run/sql-assert@1.0.3");
            expect(actual.stderr.trim()).equals("");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([["SQL_ASSERT_MOD", null]]);
            await mleSession.execute(`
                create or replace function simple_sql_name(in_name in varchar2)
                    return varchar2 is
                        mle module sql_assert_mod
                        signature 'simpleSqlName(string)';
            `);
            const result = await mleSession.execute("select simple_sql_name(' a_test ')");
            expect(JSON.stringify(result.rows)).equals('[["a_test"]]');
        }, timeout);
        it("should install sql-assert with version number)", async () => {
            const actual = await runSqlcl("script mle.js install sql_assert_mod https://esm.run/sql-assert@1.0.3 1.0.3");
            expect(actual.stderr.trim()).equals("");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([["SQL_ASSERT_MOD", "1.0.3"]]);
        }, timeout);
        it("should report too many parameters)", async () => {
            const actual = await runSqlcl("script mle.js install sql_assert_mod https://esm.run/sql-assert@1.0.3 1.0.3 too-many");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("too many parameters passed.");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
        it("should report cannot get content)", async () => {
            const actual = await runSqlcl("script mle.js install sql_assert_mod https://esm.run/sql-assert@0.0.0");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("cannot get content of 'https://esm.run/sql-assert@0.0.0'");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
    });

    describe("install mle module from file", () => {
        const file = tempfile({extension: 'js'});
        writeFileSync(file, `export function toEpoch(ts) {\n    return ts.valueOf();\n}`);
        it("should install util_mod without version number)", async () => {
            const actual = await runSqlcl(`script mle.js install util_mod ${file}`);
            expect(actual.stderr.trim()).equals("");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([["UTIL_MOD", null]]);
            await mleSession.execute(`
                create or replace function to_epoch(in_ts in timestamp)
                   return number is
                      mle module util_mod
                      signature 'toEpoch(Date)';
            `);
            const result = await mleSession.execute("select to_epoch(systimestamp)");
            expect(result.rows?.length).equals(1);
        }, timeout);
        it("should install util_mod with version number)", async () => {
            const actual = await runSqlcl(`script mle.js install util_mod ${file} 1.0.0`);
            expect(actual.stderr.trim()).equals("");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([["UTIL_MOD", "1.0.0"]]);
        }, timeout);
        it("should install util_mod with version number via SQLcl command)", async () => {
            const actual = await runSqlcl(`script mle.js register\nmle install util_mod ${file} 1.2.3`);
            expect(actual.stderr.trim()).equals("");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([["UTIL_MOD", "1.2.3"]]);
        }, timeout);
        it("should report too many parameters)", async () => {
            const actual = await runSqlcl(`script mle.js install util_mod ${file} 1.0.0 too-many`);
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("too many parameters passed.");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
        it("should report cannot get content)", async () => {
            const actual = await runSqlcl(`script mle.js install util_mod ${file}xyz 1.0.0`);
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains(`cannot get content of '${file}xyz'`);
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
    });

    describe("common errors", () => {
        it("should report missing mandatory subcommand)", async () => {
            const actual = await runSqlcl("script mle.js");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("missing mandatory subcommand.");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
        it("should report missing mandatory <moduleName>)", async () => {
            const actual = await runSqlcl("script mle.js install");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("missing mandatory <moduleName>.");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
        it("should report missing mandatory <url> or <filename>)", async () => {
            const actual = await runSqlcl("script mle.js install sql_assert_mod");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("missing mandatory <url> or <fileName>.");
            const modules = await mleSession.execute("select module_name, version from user_mle_modules");
            expect(modules.rows).toEqual([]);
        }, timeout);
    });

    describe("other subcommands", () => {
        it("should register mle as SQLcl command)", async () => {
            const actual = await runSqlcl("script mle.js register");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("mle registered as SQLcl command.");
        }, timeout);
        it("should show help)", async () => {
            const actual = await runSqlcl("script mle.js help");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).contains("Valid subcommands and options are:");
        }, timeout);
        it("should show version)", async () => {
            const actual = await runSqlcl("script mle.js version");
            expect(actual.stderr.trim()).equals("");
            expect(actual.stdout).toMatch(/MLE version \d+\.\d+\.\d+/);
        }, timeout);

    });

    afterAll(async () => {
        await closeSessions();
    });
});
