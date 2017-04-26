var fs = require("fs");
var parse = require("csv-parse");


var defrostStart =[];
var defrostEnd =[];
var data;

var avgDataArray= [];
var avgDataObj ={variableName:'',
					avgValue:''}

var cop = 31;
var heatPower = 33;
var elecPower=32;
var humidity=21;
var inletTemp= 15;
var outletTemp = 17;
var roomTemp = [9,10,11,12];



var input = 'rmh';
var siteList =[];
var fileExt = './data';
var defrostData=[];
var collectionPeriod =[];
var parsedData;
var startPeriod;
var endPeriod;
var prePeriodEnd;
var equilibriumPoint;
var deltaTemp;
var startDataCollectArray=[];
var endDataCollectArray=[];

var avgCop;
var avgHeatPower;
var avgElecPower;
var avgHumidity;
var avgInletTemp;
var avgOutletTemp;
var avgRoomTemp;

var objectData= ['cop','heatPower','elecPower','humidity','inletTemp','outletTemp','ambient'];

//var periodLength;

//Get list of filenames in data file
getFilename(fileExt,function(files){
	//Open specific file and parse data to arra
	openFileAndParse(files[2], function(output){
		parsedData= output;
		//Find defrost postions within array
		defrostFinder(parsedData,function(defrostStarts,defrostEnds){
			//Check data for any defrosts
			if(testType() == 'Steady State'){
				//Set start period based on 10min preconditioning, 60min equlibrium
				startPeriod = ((10+60)*6);
				//Set end period based on 70min data collection 
				endPeriod = startPeriod + (70*6);
				
				//Calculate degradation of water temp over 70minutes
				deltaTemp = deltaTComparison(startPeriod);
				//Check that deltaT doesent degrade by more than 2.5% in the 70minutes
				if(testType2() == 'Steady State'){
					//Return avg data for above
					avgAllData();
					logAvgData();
				} else if(testType2() == 'Transient'){
					//Make data collection period 180mins instead of 70mins
					endPeriod = startPeriod + (180*6);
					//Return avg data
					avgAllData();
					logAvgData();
				}

			} else {

				//Create array 'defrostData' containing all defrost start and end points 
				defrostArray(defrostStarts,defrostEnds);
				console.log(defrostData);
				//Check 10minutes of data previous to first defrost if not prePeriodEnd is set to next defrost period
				prePeriodEnd = checkPrePeriod();
				//find equilibrium point after defrost
				equilibriumPoint = findEquilibriumPoint(parsedData,defrostData[prePeriodEnd].end);
				//Data collection must start 60mins after equilibrium of previous defrost 
				var startDataCollect = equilibriumPoint + (60*6);
				var endDataCollect = startDataCollect + (180*6);
				//Make array of all defrosts that end after the collection period time has started
				for(var i=0;i<defrostData.length;i++){	
					if(startDataCollect < defrostData[i].end){
						startDataCollectArray.push(defrostData[i].end);
						//console.log(defrostData[i].end)
					}
				}
				//Make array of all defrosts that end before the collection period time has ended
				for(var i=0;i<defrostData.length;i++){
					if(defrostData[i].end<endDataCollect ){
						endDataCollectArray.push(defrostData[i].end);
					}
				}

				startPeriod = startDataCollectArray[0];
				endPeriod = endDataCollectArray[endDataCollectArray.length-1];
				periodLength = endPeriod - startPeriod;



				console.log(startDataCollectArray);
				console.log(endDataCollectArray);

				console.log('Data Collection Period: '+ roundWhole(periodLength/6) +'mins')
				console.log('No. of Defrosts in Period: ' + countDefrosts());
				console.log(collectionDefrostData());
				//Average Data
				avgAllData();
				logAvgData();
				//log avg for defrost
				console.log(defrostAvg());
				console.log(heatingAvg());

				console.log('Minimum Air Temp in Period: '+ minAirforPeriod(startPeriod,endPeriod));
				console.log('Maximum Air Temp in Period: '+ maxAirforPeriod(startPeriod,endPeriod));
				console.log(heatingAvgTotal(objectData[0]))
				console.log(heatingAvgTotal(objectData[1]));
			}
		})
	})
})
//FUNCTIONS
//Find out whether there are any defrosts in data
function testType(){
	for(var i=6; i<parsedData.length;i++){
		
		if(parsedData[i][cop]<0){
			return 'Transient Test';
		} 

		if(i==parsedData.length -1){
			return 'Steady State';
		}
	}
	
}
//Find out whether data drops by more than 2.5% 
function testType2(){
	for(var i=0;i<deltaTemp.length;i++){
		if(deltaTemp[i]< (-2.5)){
			return 'Transient';
		} else if (i == deltaTemp.length-1){
			return 'Steady State'
		}
	}
}

//Calculate 5min average of water temp from start position
function deltaT(startPosition){
	startBin = 0
	startEndPeriod = startPosition + (6*5);
	for(var i =startPosition; i<startEndPeriod;i++){
		startBin += deltaAirWater([i]);
	}

	startAvg= startBin/(6*5);
	return startAvg;

}
//Compare startpostion temperature with subsquent 5 minute portions
function deltaTComparison(startPosition){
	start = deltaT(startPosition);
	periodLength = 6*5;
	totalPeriod = 6*70;
	periodArray=[];
	startPoint = startPosition + periodLength;
	endPoint = startPosition+totalPeriod;
	console.log(startPoint);
	console.log(endPoint);
	//compare start with 60mins periods of 5mins
	for(var i =startPoint; i<endPoint;i+=periodLength){
		console.log(i);
		diff = start - deltaT(i);
		percentDiff = (diff/start)*100;
		periodArray.push(percentDiff);
	}

	return periodArray;
}

//return water temp at postion
function deltaAirWater(position){
	
	currentWater = Number(parsedData[position][outletTemp]);
	//currentAir = airTempAvg(parsedData[position]);

	currentDiff = currentWater //- currentAir;
	return currentDiff;
}

//confirm there is a 10minute preconditioning period before initial defrost; if not use next defrost
function checkPrePeriod(){
	if(defrostData[0].start > ((10*6))){
		return 0;
	} else if (defrostData[1].start > ((10*6))){
		return 1;
	}
}

//find point after defrost where water temp as settled out
function findEquilibriumPoint(data, firstDefrostEnd){
	for(var i =firstDefrostEnd; i<data.length;i++){
		previousWater = Number(data[i-6][outletTemp]);
		currentWater = Number(data[i][outletTemp]);
		//previousAir = airTempAvg(data[i-1]);
		//currentAir = airTempAvg(data[i]);

		previousDiff = previousWater //- previousAir;
		currentDiff = currentWater //- currentAir;
		
		currentDiffLow = currentDiff * 0.99;
		currentDiffHigh = currentDiff * 1.01;
		if(previousDiff < currentDiffHigh && previousDiff > currentDiffLow){
			console.log('End of Equilibrium Period After Defrost: '+ i);
			return i;
		}
	}
}

//Return average for variable for the collection period
function getData(variable){
	var dataBin =0;
	for(var i = startPeriod; i<endPeriod;i++){

		dataBin += Number(parsedData[i][variable]);
		//console.log(dataBin);
	
	}
	var avg = dataBin/periodLength;
	return avg;
}

//Return average for variable within a speified period
function getDataforSpecificPeriod(variable,startPeriodSpecific,endPeriodSpecific){
	var dataBin =0;
	for(var i = startPeriodSpecific; i<endPeriodSpecific;i++){

		dataBin += Number(parsedData[i][variable]);
		//console.log(dataBin);
	
	}
	var avg = dataBin/(endPeriodSpecific-startPeriodSpecific);
	return avg;
}

//Return the average air temp for the collection period
function getDataAir(){
	var dataBin =0;
	for(var i = startPeriod; i<endPeriod;i++){
		//console.log(airTempAvg(parsedData[i]));
		dataBin += airTempAvg(parsedData[i]);
		//console.log(dataBin);
	
	}
	var avg = dataBin/periodLength;
	return avg;
}

//Return the average air temp for a specific collection period
function getDataAirforSpecificPeriod(startSpecificPeriod,endSpecificPeriod){
	var dataBin =0;
	for(var i = startSpecificPeriod; i<endSpecificPeriod;i++){
		//console.log(airTempAvg(parsedData[i]));
		dataBin += airTempAvg(parsedData[i]);
		//console.log(dataBin);
	}
	var avg = dataBin/(endSpecificPeriod-startSpecificPeriod);
	return avg;
}

//Get list of filenames within the data file; call back array
function getFilename(fileExt,callback){
	fs.readdir(fileExt, function(err, files){
		console.log(files[2]);
		callback(files);
	})	
}

//Opens the specific file in data folder and parses the csv into an Array
function openFileAndParse(filename,callback){
	var file = 'data/'+filename;
	fs.readFile(file, 'utf8', function(err,data){
			//console.log(data);
			// parse(data, {comment: '#'}, function(err,output){
			// 	//console.log(output[0]);
			// 	callback(output);
			// });
			csvtoArrayConverter(data,function(output){
				callback(output);
			})
		})
}

//Find all start and end points for defrosts
function defrostFinder(data,callback){
	for(var i = 6;i<data.length;i++){
		if(data[i][cop]<0 && data[i-1][cop]>0){
			defrostStart.push(i);
		} else if(data[i][cop]>0 && data[i-1][cop]<0){
			defrostEnd.push(i);
		}
	}
	callback(defrostStart,defrostEnd);
}

//Ceate an array with objects containing eaach defrost point
function defrostArray(defrostStart,defrostEnd){
	for(var i = 0; i<defrostStart.length;i++){
		//console.log(defrostStart[i]);
		//console.log(i)
		var defrostContainer = {No:'',
								start:'',
		 						end:''}
		//if(i=0 && defrostStart[i] < defrostEnd[i]){

		 	defrostContainer.No = i+1;
		 	defrostContainer.start = defrostStart[i];
		 	defrostContainer.end = defrostEnd[i];
		 	defrostData.push(defrostContainer);
		//}
	}
}

//Return average air temperature for single point in data
function airTempAvg(data){
	var avg =0;
	for(var i=0; i<roomTemp.length;i++){
		avg += Number(data[roomTemp[i]]);
	}
	avg =avg/4;
	return avg;
}

//Get average data for collection period
function avgAllData(){

	avgCop = getData(cop);
	avgHeatPower = getData(heatPower);
	avgElecPower = getData(elecPower);
	avgHumidity = getData(humidity);
	avgInletTemp = getData(inletTemp);
	avgOutletTemp = getData(outletTemp);
	avgRoomTemp = getDataAir();

}

//Get average data for a specific period
function avgAllDataForSpecificPeriod(startSpecificPeriod,endSpecificPeriod){
	specificPeriodAvg=[];
	getDataforSpecificPeriod(cop,startSpecificPeriod,endSpecificPeriod);

}

//Log average data for collection period
function logAvgData(){
	console.log('COP:'+round(avgCop));
	console.log('Power Output:'+round(avgHeatPower)+'kW');
	console.log('Power Input: '+ round(avgElecPower)+'kW');
	console.log('Humidity: '+round(avgHumidity)+'%RH');
	console.log('Return Temp: '+round(avgInletTemp)+'deg.C');
	console.log('Flow Temp: '+round(avgOutletTemp)+'deg.C');
	console.log('Ambient Temp: '+round(avgRoomTemp)+'deg.C');
}

//round number to 2d.p
function round(number){
	return (Math.round(number*100)/100)
}

//round number to 1d.p
function roundWhole(number){
	return (Math.round(number*1)/1)
}

//Using defrost end time find defrost number in defrostData array
function matchDefrost(endTime){
	for(var i=0; i<defrostData.length;i++){
		if(endTime == defrostData[i].end){
			return defrostData[i].No;
		}
	}
}

//Count number of defrosts that occur within collection period
function countDefrosts(){
	defrostNumber = matchDefrost(endPeriod)- matchDefrost(startPeriod);
	return defrostNumber;
}

//Return defrost array of defrosts just within the collection period 
function collectionDefrostData(){
	var defrosts =[];
	for(var i=0;i<startDataCollectArray.length;i++){
		match = startDataCollectArray[i];
		for(var h =0; h<endDataCollectArray.length;h++){
			if(match == endDataCollectArray[h]){
				defrosts.push(endDataCollectArray[h]);
			}
		}

		if(i==startDataCollectArray.length-1){
			var defrosts2=[];
			for(var k =0; k<defrosts.length;k++){
				match2=defrosts[k];
				for(var l =0; l<defrostData.length;l++){
					if(match2==defrostData[l].end){
						defrosts2.push(defrostData[l]);
					}
				}
			}
			//defrosts2.shift();
		return defrosts2;	
		}
	}	
}

//Return avg data just for defrost data within the collection period
function defrostAvg(){
	defrostDataArray1= collectionDefrostData();
	//console.log(defrostDataArray1);
	defrostBin=[]
	for(var i=0; i<defrostDataArray1.length;i++){

		copAvg = getDataforSpecificPeriod(cop,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgHeatPower = getDataforSpecificPeriod(heatPower,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgElecPower = getDataforSpecificPeriod(elecPower,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgHumidity = getDataforSpecificPeriod(humidity,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgInletTemp = getDataforSpecificPeriod(inletTemp,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgOutletTemp = getDataforSpecificPeriod(outletTemp,defrostDataArray1[i].start,defrostDataArray1[i].end);
		avgRoomTemp = getDataAirforSpecificPeriod(defrostDataArray1[i].start,defrostDataArray1[i].end);

		maxInletTemp = maxVariableforPeriod(inletTemp,defrostDataArray1[i].start,defrostDataArray1[i].end)
		maxAirTemp = maxAirforPeriod(defrostDataArray1[i].start,defrostDataArray1[i].end);
		minAirTemp = minAirforPeriod(defrostDataArray1[i].start,defrostDataArray1[i].end);
		defrostObject={No:i,
						start:defrostDataArray1[i].start,
						end: defrostDataArray1[i].end,
						cop: copAvg,
						heatPower: avgHeatPower,
						elecPower: avgElecPower,
						humidity: avgHumidity,
						inletTemp: avgInletTemp,
						outletTemp: avgOutletTemp,
						ambient:avgRoomTemp,
						length:((defrostDataArray1[i].end- defrostDataArray1[i].start)*10)+'secs',
						maxInletTemp: maxInletTemp,
						maxAirTemp: maxAirTemp,
						minAirTemp: minAirTemp}
		
		defrostBin.push(defrostObject);
	}
	return defrostBin;
}

//find maximum value for a variable within a period
function maxVariableforPeriod(variable,startPeriodSpecific,endPeriodSpecific){
	maxValue= parsedData[startPeriodSpecific][variable];
	for(var i=startPeriodSpecific; i<endPeriodSpecific;i++){
		if(parsedData[i][variable]>maxValue){
			maxValue= parsedData[i][variable];
		}
	}
	return maxValue;
}

//find minimum value for a variable within a period
function minVariableforPeriod(variable,startPeriodSpecific,endPeriodSpecific){
	minValue= parsedData[startPeriodSpecific][variable];
	for(var i=startPeriodSpecific; i<endPeriodSpecific;i++){
		if(minValue>parsedData[i][variable]){
			minValue= parsedData[i][variable];
		}
	}
	return minValue;
}

//find maximum value for air in period
function maxAirforPeriod(startPeriodSpecific,endPeriodSpecific){
	maxValue= airTempAvg(parsedData[startPeriodSpecific]);
	for(var i=startPeriodSpecific; i<endPeriodSpecific;i++){
		if(airTempAvg(parsedData[i])>maxValue){
			maxValue= airTempAvg(parsedData[i]);
		}
	}
	return maxValue;
}

//find minimum for air in period
function minAirforPeriod(startPeriodSpecific,endPeriodSpecific){
	minValue= airTempAvg(parsedData[startPeriodSpecific]);
	for(var i=startPeriodSpecific; i<endPeriodSpecific;i++){
		if(minValue>airTempAvg(parsedData[i])){
			minValue= airTempAvg(parsedData[i]);
		}
	}
	return minValue;
}

//Return avg data just for heating data within the collection period
function heatingAvg(){
	defrostDataArray1= collectionDefrostData();
	//console.log(defrostDataArray1);
	defrostBin=[]
	for(var i=1; i<defrostDataArray1.length;i++){

		copAvg = getDataforSpecificPeriod(cop,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgHeatPower = getDataforSpecificPeriod(heatPower,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgElecPower = getDataforSpecificPeriod(elecPower,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgHumidity = getDataforSpecificPeriod(humidity,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgInletTemp = getDataforSpecificPeriod(inletTemp,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgOutletTemp = getDataforSpecificPeriod(outletTemp,defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		avgRoomTemp = getDataAirforSpecificPeriod(defrostDataArray1[i-1].end,defrostDataArray1[i].start);

		maxInletTemp = maxVariableforPeriod(inletTemp,defrostDataArray1[i-1].end,defrostDataArray1[i].start)
		maxAirTemp = maxAirforPeriod(defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		minAirTemp = minAirforPeriod(defrostDataArray1[i-1].end,defrostDataArray1[i].start);
		defrostObject={No:i,
						start:defrostDataArray1[i-1].end,
						end: defrostDataArray1[i].start,
						cop: copAvg,
						heatPower: avgHeatPower,
						elecPower: avgElecPower,
						humidity: avgHumidity,
						inletTemp: avgInletTemp,
						outletTemp: avgOutletTemp,
						ambient:avgRoomTemp,
						length:((defrostDataArray1[i].end- defrostDataArray1[i].start)*10)+'secs',
						maxInletTemp: maxInletTemp,
						maxAirTemp: maxAirTemp,
						minAirTemp: minAirTemp}
		
		defrostBin.push(defrostObject);
	}
	return defrostBin;
}

//Return average for just the heating periods for specific variable (item)
function heatingAvgTotal(input){
	avgData = heatingAvg();
	output=0;
	for(var i=0; i<avgData.length; i++){
		output += avgData[i][input];
	}
	output =output/avgData.length;
	return round(output);
}

//Converts data file (.csv) into a data array
function csvtoArrayConverter(data,callback){
	//split file at \r\n characters
	modFile = data.split('\r\n');
	//remove first 5 rows (strings)
	modFileSplit = modFile.slice(5,modFile.length);
	//split each row (string) into array at , character
	modFile2=[];
	for(var i =0; i<modFileSplit.length; i++){		
		modFile2.push(modFileSplit[i].split(','));
		//console.log(modFile2[i]);
	}
	//remove any arrays that do not contain the same number of items as the first row
	for(var i=0; i<modFile2.length;i++){
		if(modFile2[i].length < modFile2[0].length){
			modFile2.splice(i,1);
		}
	}
	callback(modFile2);
}

// function avgMultipleSection(data){
// 	avgData = data;
// 	for(var i=0; i<avgData.length; i++){
// 		= avgData.cop

// 	}

// }