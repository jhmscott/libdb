/**
 * Copyright (c) 2022
 *
 * Database Module
 *
 * @summary Base class providing abstraction to database tables
 * @author Justin Scott
 *
 * Created at     : 2022-04-10
 * Last modified  : 2022-04-10
 */

///////////////////////////////////////////////////////////////////////////////
/// IMPORTS
///////////////////////////////////////////////////////////////////////////////

import mssql    from 'mssql';
import util     from 'util';

///////////////////////////////////////////////////////////////////////////////
/// CLASSES
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
/// Database table base class
///
/// Provides basic table interface and protected methods for interfacing with
/// MS SQL database
///////////////////////////////////////////////////////////////////////////////
export default class TableBase
{
    private static _globalConnection: mssql.ConnectionPool;
    private _id: number;
    private _tableName: string;

    ///////////////////////////////////////////////////////////////////////////////
    /// Default constructor
    ///
    /// @param[in] id           Database id of this entry
    /// @param[in] tableName    Name of this database table
    ///////////////////////////////////////////////////////////////////////////////
    protected constructor (id: number, tableName: string)
    {
        this._id        = id;
        this._tableName = tableName;
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Get global connection
    ///
    /// @returns MS SQL connection pool
    ///////////////////////////////////////////////////////////////////////////////
    private get globalConnection (): mssql.ConnectionPool
    {
        return TableBase._globalConnection;
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Get id
    ///
    /// @returns Database id
    ///////////////////////////////////////////////////////////////////////////////
    protected get id (): number
    {
        return this._id;
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Get table name
    ///
    /// @returns Name of this table
    ///////////////////////////////////////////////////////////////////////////////
    protected get tableName (): string
    {
        return this._tableName;
    }

    get json ()
    {
        return {};
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Delete database entry
    ///
    /// Deletes this entry from the database
    ///////////////////////////////////////////////////////////////////////////////
    async delete ()
    {
        const sqlReq: mssql.Request  = new mssql.Request (this.globalConnection);
        sqlReq.input ('id', this._id);

        await sqlReq.query (`DELETE FROM ${this._tableName} WHERE id = @id`);
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Update database
    ///
    /// Updates this database entry
    ///
    /// @param[in] fields   Object with keys corresponding to table columns and
    ///                     values corresponding to new entries
    ///////////////////////////////////////////////////////////////////////////////
    protected async update (fields: object)
    {
        const sqlReq: mssql.Request  = new mssql.Request (this.globalConnection);
        let updateList: string = "";

        sqlReq.input ('id', this._id);

        for (const key in fields)
        {
            sqlReq.input (key, fields[key]);
            updateList += `${key} = @${key}, `;
        }

        await sqlReq.query (`UPDATE ${this._tableName} SET ${updateList} WHERE id = @id`);
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Insert into database
    ///
    /// Inserts a row into the database table
    ///
    /// @param[in] fields       Object with keys corresponding to table columns and
    ///                         values corresponding to new entries.
    /// @param[in] tableName    Name of table to insert into
    ///////////////////////////////////////////////////////////////////////////////
    protected static async insert (fields: object, tableName: string)
    {
        const sqlReq: mssql.Request  = new mssql.Request (this._globalConnection);
        let columnList: string = "";
        let valueList: string  = "";

        for (const key in fields)
        {
            sqlReq.input (key, fields[key]);
            columnList += `${key}, `;
            valueList  += `@${key}, `
        }

        columnList  = columnList.slice (0, -2);

        valueList  = valueList.slice (0, -2);

        await sqlReq.query (`INSET INTO ${tableName} (${columnList}) VALUES (${valueList})`);
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Init database
    ///
    /// Initializes database connection
    ///
    /// @param[in] dbConfig Database configuration object
    /// @param[in] callback Callback to call when database connects
    ///////////////////////////////////////////////////////////////////////////////
    static async initDb (dbConfig: mssql.config): Promise<void>
    {
        this._globalConnection = await util.promisify (mssql.ConnectionPool).bind (mssql) (dbConfig);
    }

    ///////////////////////////////////////////////////////////////////////////////
    /// Un-init database
    ///
    /// Closes connection to database
    ///////////////////////////////////////////////////////////////////////////////
    static async uninitDb ()
    {
        if (this._globalConnection)
        {
            await util.promisify (this._globalConnection.close).bind (this._globalConnection) ();
        }
        else
        {
            throw "Connection not configured";
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    /// Get record from id
    ///
    /// Gets database record from id
    ///
    /// @param[in] id           Id of the entry
    /// @param[in] tableName    Name of table to get records from
    ///
    /// @returns   Database record
    //////////////////////////////////////////////////////////////////////////////
    protected static async getRecordFromId (id: number, tableName: string): Promise<mssql.IResult<any>>
    {
        const sqlReq: mssql.Request  = new mssql.Request (this._globalConnection);

        sqlReq.input ('id', id);

        return (await sqlReq.query(`SELECT * FROM ${tableName} WHERE id = @id`));
    }

    //////////////////////////////////////////////////////////////////////////////
    /// Get all records
    ///
    /// Gets all records for a table
    ///
    /// @param[in] tableName    Name of table to get records from
    /// @param[in]  condition   Filter condition
    ///
    /// @returns Array of records
    //////////////////////////////////////////////////////////////////////////////
    protected static async getAllRecords (tableName: string, conditions: any = null): Promise<mssql.IResult<any>>
    {
        const sqlReq: mssql.Request  = new mssql.Request (this._globalConnection);
        let conditionList: string = "";

        if (null !== conditions)
        {
            conditionList = "WHERE "
            for (const key in conditions)
            {
                sqlReq.input (key, conditions[key]);
                conditionList += `${key} = @${key}, `;
            }
        }

        return (await sqlReq.query(`SELECT * FROM ${tableName} ${conditionList}`));
    }

    //////////////////////////////////////////////////////////////////////////////
    /// Get from record virtual function
    ///
    /// Converts a database record to a TableBase object. Overridden by child classes
    ///
    /// @param[in]   record     MS SQL record
    ///
    /// @returns    TableBase object
    //////////////////////////////////////////////////////////////////////////////
    protected static fromRecord (record: any): TableBase { return null; }

    //////////////////////////////////////////////////////////////////////////////
    /// Get from id
    ///
    /// Gets TableBase object for database id
    ///
    /// @param[in] id           Database id of the entry
    /// @param[in] tableName    Name of table to get records from
    ///
    /// @returns   TableBase object
    //////////////////////////////////////////////////////////////////////////////
    protected static async getFromId (id: number, tableName: string): Promise<TableBase>
    {
        let tableEntry: TableBase = null;

        const result = await TableBase.getRecordFromId (id, tableName);

        if (1 === result.recordset.length)
        {
            tableEntry = this.fromRecord (result.recordset[0]);
        }

        return tableEntry;
    }

    //////////////////////////////////////////////////////////////////////////////
    /// Get all
    ///
    /// Gets all entries in the database
    ///
    /// @param[in]  tableName   Name of table to get records from
    /// @param[in]  condition   Filter condition
    ///
    /// @returns    Array of table base objects
    //////////////////////////////////////////////////////////////////////////////
    protected static async getAll (tableName: string, condition: any = null): Promise<Array<TableBase>>
    {
        let tableEntries: Array<TableBase> = [];

        const result = await TableBase.getAllRecords (tableName, condition);

        if (0 < result.recordset.length)
        {
            result.recordset.forEach (function (record)
            {
                tableEntries.push(this.fromRecord (record));
            });
        }

        return tableEntries;
    }
}