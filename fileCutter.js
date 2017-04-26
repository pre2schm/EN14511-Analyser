var fs = require("fs");
var parse = require("csv-parse");


var input = 'rmh';
var siteList =[];
var fileExt = './data';
var modFile = [];
var modFileSplit =[];
var modFileSplitString;
var modFile2 =[];

getFilename(fileExt, function(file){
	openFileAndParse(file[1],function(output){
		csvtoArrayConverter(output,function(parsedOutput){
			console.log(parsedOutput);
		})
	});
});

function csvtoArrayConverter(data,callback){
	//split file at \r\n characters
	modFile = data.split('\r\n');
	//remove first 5 rows (strings)
	modFileSplit = modFile.slice(5,modFile.length);
	//split each row (string) into array at , character
	modFile2=[];
	for(var i =0; i<modFileSplit.length; i++){		
		modFile2.push(modFileSplit[i].split(','));
		console.log(modFile2[i]);
	}
	//remove any arrays that do not contain the same number of items as the first row
	for(var i=0; i<modFile2.length;i++){
		if(modFile2[i].length < modFile2[0].length){
			modFile2.splice(i,1);
		}
	}
	callback(modFile2);
}



function openFileAndParse(filename,callback){
	var file = 'data/'+filename;
	fs.readFile(file, 'utf8', function(err,data){
			//console.log(data);
			//parse(data, {comment: '#'}, function(err,output){
				//console.log(output[0]);
				callback(data);
			//});
		})
}

function getFilename(fileExt,callback){
	fs.readdir(fileExt, function(err, files){
		console.log(files[1]);
		callback(files);
	})	
}