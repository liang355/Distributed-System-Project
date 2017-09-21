/*
lineReader will extract the records from amazon-meta.txt one at a time as
file is too large to read all at once.  In order to add records to a database you need to add code below to insert records

This code depnds on "line-reader"

You need to install line-reader by using the following command:
npm install line-reader

*/

//This assumes that you're using mysql.  You'll need to change this if you're using another database
var mysql      = require('mysql'),
    co         = require('co'),
    wrapper    = require('co-mysql');
var jsonRecord;
var query;
var execute = true;
var totalRecords = 0;
var fs = require('fs');
var fileName = "data/alsoBought.csv";


var lineReader = require('line-reader');

var connection = mysql.createConnection({
   host: '',
   port: ,
   user: '',
   password: '!',
   database: ''
});

connection.connect(function (err) {
    if (!err) {
        console.log("Database is connected ... \n\n");
    } else {
        console.log("Error connecting database ... \n\n");
    }
});
//var sql = wrapper(connection);

var values = []; //The records read from the file.
//var groups = [];
var numRecords = 0; //The current number of records read from the file.
var recordBlock = 20; //The number of records to write at once.

lineReader.eachLine(fileName, function(line, last) {
    execute = false;
    currentLine = line.toString();
    var asins = currentLine.split(',');
    values.push(asins);
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
});//lineReader.eachLine
