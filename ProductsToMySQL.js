/**
 * Created by yingbinliang on 4/30/17.
 */
var express = require('express');
var path = require('path');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var lineReader= require('node-line-reader').LineReader;
var app = express();

//Connecting to DB ...
var connection = mysql.createConnection({
    host: '',
    port: ,
    user: '',
    password: '',
    database: ''
});

connection.connect(function (err) {
    if (!err) {
        console.log("Database is connected ... \n\n");
    } else {
        console.log("Error connecting database ... \n\n");
    }
});

var sessionStore = new MySQLStore({
    host: 'mysql-aws.cpskqquiopaa.us-west-2.rds.amazonaws.com',
    port: 3306,
    user: 'root',
    password: 'Password1990!',
    database: 'MyDatabase',
    checkExpirationInterval: 15 * 60000, // How frequently expired sessions will be cleared; milliseconds.
    expiration: 15 * 60000,              // The maximum age of a valid session; milliseconds.
    createDatabaseTable: true,      // Whether or not to create the sessions database table, if one does not already exist.
    connectionLimit: 2,             // Number of connections when creating a connection pool
    schema: {
        tableName: 'Sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

app.set('port', 3000);
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

app.use(session({
    key: 'myCookies',
    secret: 'keyboard cat',
    store: sessionStore,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 15 * 60000,
        rolling: true
    }
}));

app.post('/loadProducts', function (req, res) {
    var reader = new lineReader(path.join(__dirname + '/data', 'productRecords.json'));

    function maskEmptyCategories(categories){
        if(!categories) {
            return undefined;
        }
        return categories[0].join();
    }

    // Each execution of nextLine will get a following line of text from the input file
    var i = 0;
    var count = 0;
    while(i < 3359665) {
        reader.nextLine(function (err, line) {
            if (!err) {
                var parsedJSON = JSON.parse(line);
                var sql = `INSERT INTO Products SET asin='` + parsedJSON.asin + `', productName='` + parsedJSON.title + `', productDescription='` + parsedJSON.description + '\', `group`=\'' + maskEmptyCategories(parsedJSON.categories) + '\'';
                console.log(++count);
                console.log(parsedJSON);
                console.log(sql);

                connection.query(sql, function (err, rows){
                    if(err){
                        console.log(err);
                    }
                    else {
                        console.log("successful: " + parsedJSON.title + " was successfully added to the system");
                    }
                });
            }
        });
        i++;
    }
});

app.listen(app.get('port'));
console.log('Express server listening on port ' + app.get('port'));