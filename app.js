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

//Routes ...
app.get('/index', function (req, res) {
    res.send({"message": "health check!"});
});

app.post('/registerUser', function (req, res) {
    var params = [req.body.fname, req.body.lname, req.body.address, req.body.city,
        req.body.state, req.body.zip, req.body.email, req.body.username, req.body.password];

    function processParams(params) {
        function addQuotationMark(s) {
            return "'" + s + "'";
        }

        var result;
        result = params.map(addQuotationMark);
        result = result.join(",");
        return result;
    }

    if (params.includes(undefined)) {
        res.send({"message": "The input you provided is not valid"});
    }
    else {
        connection.query('INSERT INTO Users (fname,lname,address,city,state,zip,email,username,password) ' +
            'VALUES (' + processParams(params) + ')', function (err, rows) {
            if (err) {
                res.send({"message": "ERROR!"});
            }
            else {
                res.send({"message": req.body.fname + " was registered successfully"});
            }
        });
    }
});

app.post('/login', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    connection.query(`SELECT * FROM Users WHERE username = '${username}' AND \`password\` = '${password}'`, function (err, rows) {
        if(err){
            console.log(err);
        } else {
            if(rows.length == 0){
                res.send({"message": "There seems to be an issue with the username/password combination that you entered"});
            } else {
                req.session.user = rows[0];
                res.send({"message": "Welcome " + rows[0].fname});
            }
        }
    });
});

app.post('/logout', function (req, res) {
    if (req.session.user) {
        req.session.destroy(function () {
            res.send({"message": "You have been successfully logged out"});
        });
    }else{
        res.send({"message": "You are not currently logged in"});
    }
});

app.post('/updateInfo', function (req, res) {
    function constructSetterString(object) {
        var setterArray = [];
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property] !== undefined) {
                var subString = property + "=" + "'" + object[property] + "'";
                setterArray.push(subString);
            }
        }
        return setterArray.join(", ");  // prop1='val1', prop2='val2' ...
    }

    if (req.session.user) {
        var setterString = constructSetterString(req.body);
        connection.query('UPDATE Users SET ' + setterString +
            ' WHERE username = ' + "'" + req.session.user.username + "'", function (err, rows) {
            if (err) {
                console.log(err);
                res.send({"message": "The input you provided is not valid"});
            }
            else {
                res.send({"message": req.session.user.fname + " your information was successfully updated"});
            }
        });
    }
    else {
        res.send({"message": "You are not currently logged in"});
    }
});

app.post('/addProducts', function (req, res) {
    function hasAllParams() {
        var expected_params = [req.body.asin,req.body.productName,req.body.productDescription,req.body.group];
        return !expected_params.includes(undefined);
    }

    function objectToQueryString (object){
        function addQuotationMark(s) {
            return "'" + s + "'";
        }
        var params = [];
        for(var property in object){
            if (object.hasOwnProperty(property)){
                params.push(object[property]);
            }
        }
        var result = params.map(addQuotationMark);
        return result.join(",");
    }

    if (!hasAllParams()) {
        res.send({"message": "The input you provided is not valid"});
    }
    else if (!req.session.user) {
        res.send({"message": "You are not currently logged in"});
    }
    else if (req.session.user.admin != 'true') {
            res.send({"message": "You must be an admin to perform this action"});
    }
    else {
        connection.query('INSERT INTO Products (asin,productName,productDescription,`group`) ' +
            'VALUES (' + objectToQueryString(req.body) + ')', function (err, rows){
            if(err){
                console.log(err);
                res.send({"message": "The input you provided is not valid"});
            }
            else {
                res.send({"message": req.body.productName + " was successfully added to the system"});
            }
        });
    }
});

app.post('/modifyProduct', function (req, res) {
    function constructSetterString(object) {
        var setterArray = [];
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property] !== undefined) {
                if(object[property] !== 'group'){
                    var subString = "`" + property + "`" + "=" + "'" + object[property] + "'";
                    setterArray.push(subString);
                }
                else {
                    var subString = property + "=" + "'" + object[property] + "'";
                    setterArray.push(subString);
                }
            }
        }
        return setterArray.join(", ");
    }

    function hasAllParams() {
        var expected_params = [req.body.asin,req.body.productName,req.body.productDescription,req.body.group];
        return !expected_params.includes(undefined);
    }

    if(!hasAllParams()){
        res.send({"message": "The input you provided is not valid"});
    }
    else if(!req.session.user){
        res.send({"message": "You are not currently logged in"});
    }
    else if (req.session.user.admin != 'true') {
        res.send({"message": "You must be an admin to perform this action"});
    }
    else {
        var setterString = constructSetterString(req.body);
        connection.query('UPDATE Products SET '+ setterString +' WHERE asin = ' + req.body.asin, function (err, rows) {
            if(err){
                res.send({"message": "The input you provided is not valid"});
            }
            else {
                res.send({"message": req.body.productName + " was successfully updated"});
            }
        });
    }
});

app.post('/viewUsers', function (req, res) {
    function constructSetterString(object) {
        var setterArray = [];
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property] !== undefined) {
                var subString = property + " LIKE " + "'%" + object[property] + "%'";
                setterArray.push(subString);
            }
        }
        return setterArray.join(" AND ");
    }

    function noParams(){
        var expectedParams = [req.body.fname, req.body.lname];
        return expectedParams.every(function (param){
            return param == undefined;
        });
    }

    function constructWhereStatement(object){
        if(noParams()){
            console.log("no params");
            return "";
        }
        else {
            return " WHERE " + constructSetterString(object);
        }
    }

    if(!req.session.user){
        res.send({"message": "You are not currently logged in"});
    }
    else if (req.session.user.admin != 'true') {
        res.send({"message": "You must be an admin to perform this action"});
    }
    else {
        connection.query('SELECT fname,lname,userId FROM Users' + constructWhereStatement(req.body), function (err, rows){
            if(err){
                console.log("SELECT fname lname userId failed")
            }
            else if(rows.length == 0){
                res.send({"message": "There are no users that match that criteria"});
            }
            else {
                res.send({"message": "The action was successful", "user": rows});
            }
        });
    }
});

app.post('/viewProducts', function (req, res) {
    function constructSetterString(object) {
        var setterArray = [];
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property] !== undefined) {
                var subString;
                if(property == "keyword"){
                    var subString1 = "productName" + " LIKE " + "'%" + object[property] + "%'";
                    var subString2 = "productDescription" + " LIKE " + "'%" + object[property] + "%'";
                    subString = subString1 + " OR " + subString2;
                }
                else if(property == "group") {
                    subString = "`" + property + "`" + " LIKE " + "'%" + object[property] + "%'";
                }
                else {
                    subString = property + " = " + "'" + object[property] + "'";
                }
                setterArray.push(subString);
            }
        }
        return setterArray.join(" AND ");
    }

    function noParams(){
        var expectedParams = [req.body.asin, req.body.keyword, req.body.group];
        return expectedParams.every(function (param){
            return param == undefined;
        });
    }

    function constructWhereStatement(object){
        if(noParams()){
            return "";
        }
        else {
            return " WHERE " + constructSetterString(object);
        }
    }

    connection.query('SELECT asin, productName FROM Products' + constructWhereStatement(req.body), function (err, rows) {
        if(err){
            res.send(err);
        }
        else if(rows.length == 0){
            res.send({"message": "There are no products that match that criteria"});
        }
        else {
            res.send({"product": rows});
        }
    });
});

app.post('/buyProducts', function (req, res) { //input: arrays of asins
    if (!req.session.user) {
        res.send({"message": "You are not currently logged in"});
    }
    else {
        var asins = req.body.products;
        var bool = true;
        asins.forEach(function(asin) {
            connection.query(`SELECT * FROM Products WHERE asin='` + asin + `'`, function(err, rows) {
                if(err) {
                    console.log("insert into Purchases error");
                }
                else if(rows.length == 0) {
                    bool = false;
                }
            });
        });
        if(bool == false) {
            res.send({"message": "There are no products that match that criteria"});
        }
        else {
            res.send({"message": "The action was successful"});
            asins.forEach(function(asin) {
                connection.query(`INSERT INTO Purchases SET username='` + req.session.user.username + `', asin='` + asin + `'`, function(err, rows) {
                    if(err) {
                        console.log("insert into Purchases error");
                    }
                    else {
                        console.log("success!");
                    }
                });
            });

            var pairs = [];
            for(var i = 0; i < asins.length - 1; i++) {
                for(var j = i + 1; j < asins.length; j++) {
                    var pair = [];
                    pair.push(asins[i]);
                    pair.push(asins[j]);
                    pairs.push(pair);
                }
            }

            pairs.forEach(function(pair) {
                connection.query(`SELECT * FROM AlsoBoughtCount WHERE (asin1='` + pair[0] + `' AND asin2='` + pair[1] + `')
              OR (asin1='` + pair[1] + `' AND asin2='` + pair[0] + `')`, function(err, rows) {
                    if(err){
                        console.log("error");
                        //error
                    }
                    else {
                        if(rows.length == 0) {
                            //insert
                            connection.query(`INSERT INTO AlsoBoughtCount SET asin1='` + pair[0] + `', asin2='` + pair[1] + `', count=1`, function(err, rows) {
                                console.log("inserted!")
                            });
                        }
                        else {
                            //update
                            connection.query(`UPDATE AlsoBoughtCount SET count=count+1 WHERE asin1=` + rows[0].asin1 + ` AND asin2=` + rows[0].asin2, function(err, rows) {
                                console.log("updated!")
                            });
                        }
                    }
                });
            });
        }
    }
});

app.post('/productsPurchased', function (req, res) { //input: username
    if (!req.session.user) {
        res.send({"message": "You are not currently logged in"});
    }
    else if (req.session.user.admin != 'true') {
        res.send({"message": "You must be an admin to perform this action"});
    }
    else {
        connection.query(`SELECT username FROM Purchases WHERE username='` + req.body.username, function(err, rows) {
            if(rows.length ==0) {
                res.send({"message": "There are no users that match that criteria"});
            }
            else {
                connection.query(`SELECT asin, COUNT(asin) FROM Purchases WHERE username='` + req.body.username `' GROUP BY asin`, function(err, rows) {
                    res.send({"message": "The action was successful", "products": rows});
                });
            }
        });
    }
});

app.post('/getRecommendations', function (req, res) { //input: asin
    if (!req.session.user) {
        res.send({"message": "You are not currently logged in"});
    }
    else {
        connection.query(`SELECT asin1, asin2 FROM AlsoBoughtCount WHERE asin1=asin OR asin2=asin ORDER BY count DESC LIMIT 5`, function(err, rows) {
            // get asin from (asin1, asin2)
            if(rows.length == 0) {
                res.send({"message": "There are no recommendations for that product"});
            }
            else {
                res.send({"message": "The action was successful"}, "products": rows);
            }
        });
    }
});

app.listen(app.get('port'));
console.log('Express server listening on port ' + app.get('port'));

/******************************Unused Code*********************************/

//Initialize DB ...
//var initialSQLs = ["use MyDatabase;",
//        "drop table if exists Users; ",
//        "create table Users(" +
//        "userId int NOT NULL AUTO_INCREMENT," +
//        "fname varchar(50)," +
//        "lname varchar(50)," +
//        "address varchar(50)," +
//        "city varchar(50)," +
//        "state varchar(50)," +
//        "zip varchar(50)," +
//        "email varchar(50)," +
//        "username varchar(50)," +
//        "`password` varchar(50)," +
//        "admin varchar(20)," +
//        "primary key (userid)," +
//        "unique key (username));",
//        "drop table if exists Products;",
//        "create table Products(" +
//        "asin varchar(50) unique," +
//        "productName varchar(50)," +
//        "productDescription varchar(150)," +
//        "`group` varchar(50)," +
//        "primary key (asin));",
//        "insert into Users (fname,lname,username,password,admin)" +
//        "values ('Jenny','Admin','jadmin','admin','true');"];
//initialSQLs.forEach(function (SQL, index) {
//    connection.query(SQL, function (err, rows) {
//        if (err) {
//            console.log("DB initialization failed ... \n\n");
//            console.log(err);
//        } else {
//            console.log("Initial SQL query " + (index + 1) + " executed  ... ")
//        }
//    });
//});

//app.post('/add', function (req, res) {
//    var res_object = {};
//    var query_num1 = req.body.num1;
//    var query_num2 = req.body.num2;
//
//    if (req.session.fname) {
//        if (Number.isInteger(query_num1) && Number.isInteger(query_num2)) {
//            var result = query_num1 + query_num2;
//            res_object = {"message": "The action was successful", "result": result}
//        }
//        else res_object = {"message": "The numbers you entered are not valid"}
//    }
//    else res_object = {"message": "You are not currently logged in"};
//
//    res.send(res_object);
//});
//
//app.post('/divide', function (req, res) {
//    var res_object = {};
//    var query_num1 = req.body.num1;
//    var query_num2 = req.body.num2;
//
//    if (req.session.fname) {
//        if (Number.isInteger(query_num1) && Number.isInteger(query_num2) && query_num2 != 0) {
//            var result = query_num1 / query_num2;
//            res_object = {"message": "The action was successful", "result": result}
//        }
//        else res_object = {"message": "The numbers you entered are not valid"}
//    }
//    else res_object = {"message": "You are not currently logged in"};
//
//    res.send(res_object);
//});
//
//app.post('/multiply', function (req, res) {
//    var res_object = {};
//    var query_num1 = req.body.num1;
//    var query_num2 = req.body.num2;
//
//    if (req.session.fname) {
//        if (Number.isInteger(query_num1) && Number.isInteger(query_num2)) {
//            var result = query_num1 * query_num2;
//            res_object = {"message": "The action was successful", "result": result}
//        }
//        else res_object = {"message": "The numbers you entered are not valid"}
//    }
//    else res_object = {"message": "You are not currently logged in"};
//
//    res.send(res_object);
//});
//
//app.post('/loadProducts', function (req, res) {
//    var reader = new lineReader(path.join(__dirname + '/data', 'productRecords.json'));
//
//    function maskEmptyCategories(categories){
//        if(!categories) {
//            return undefined;
//        }
//        return categories[0].join();
//    }
//
//    // Each execution of nextLine will get a following line of text from the input file
//    var i = 0;
//    var count = 0;
//    while(i < 3359665) {
//        reader.nextLine(function (err, line) {
//            if (!err) {
//                var parsedJSON = JSON.parse(line);
//                var sql = `INSERT INTO Products SET asin='` + parsedJSON.asin + `', productName='` + parsedJSON.title + `', productDescription='` + parsedJSON.description + '\', `group`=\'' + maskEmptyCategories(parsedJSON.categories) + '\'';
//                console.log(++count);
//                console.log(parsedJSON);
//                console.log(sql);
//
//                connection.query(sql, function (err, rows){
//                    if(err){
//                        console.log(err);
//                    }
//                    else {
//                        console.log("successful: " + parsedJSON.title + " was successfully added to the system");
//                    }
//                });
//            }
//        });
//        i++;
//    }
//});