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

import oracledb from "oracledb";

let sysSession: oracledb.Connection;
export let mleSession: oracledb.Connection;

const connectString = "192.168.1.8:51007/freepdb1";

const sysConfig: oracledb.ConnectionAttributes = {
    user: "sys",
    password: "oracle",
    connectString: connectString,
    privilege: oracledb.SYSDBA
};

export const mleConfig: oracledb.ConnectionAttributes = {
    user: "mle",
    password: "mle",
    connectString: connectString
};

export async function createSessions(): Promise<void> {
    sysSession = await oracledb.getConnection(sysConfig);
    await createUser(mleConfig);
    sysSession.close();
    mleSession = await oracledb.getConnection(mleConfig);
}

async function createUser(config: oracledb.ConnectionAttributes): Promise<void> {
    await sysSession.execute(`drop user if exists ${config.user} cascade`);
    await sysSession.execute(`
        create user ${config.user} identified by ${config.password}
           default tablespace users
           temporary tablespace temp
           quota 1m on users
    `);
    await sysSession.execute(`grant db_developer_role to ${config.user}`);
    await sysSession.execute(`grant execute on javascript to ${config.user}`);
}

export async function closeSessions(): Promise<void> {
    await mleSession?.close();
}
