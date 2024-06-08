

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const stationCodeMap = {
    "SURAT": "ST",
    "VALSAD": "BL",
    "VAPI": "VAPI",
    "BOISAR": "BOR",
    "BORIVALI": "BVI"
};

const fetchTrainRoute = async (trainNumber) => {
    console.log(`Fetching route for train number: ${trainNumber}`);
    const apiUrl = `https://rappid.in/apis/train.php?train_no=${trainNumber}`;
    try {
        const response = await axios.get(apiUrl);
        if (response.data.success) {
            const route = response.data.data.map(station => ({
                ...station,
                station_name: station.station_name.toUpperCase(), // Convert station name to uppercase
                timing: sanitizeTiming(station.timing),
                delay: station.delay
            }));
            return route;
        } else {
            throw new Error("Failed to fetch train route data.");
        }
    } catch (error) {
        console.error("Error fetching train route:", error);
        throw new Error("Failed to fetch train route data.");
    }
};

const fetchStationName = async (stationCode) => {
    console.log(`Fetching station name for code: ${stationCode}`);
    const apiUrl = `https://irctc1.p.rapidapi.com/api/v1/searchStation?query=${stationCode}`;
    const options = {
        method: 'GET',
        url: apiUrl,
        headers: {
            'x-rapidapi-host': 'irctc1.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY
        }
    };

    try {
        const response = await axios.request(options);
        if (response.data.status) {
            return response.data.data[0].name.toUpperCase(); // Convert station name to uppercase
        } else {
            throw new Error("Failed to fetch station name.");
        }
    } catch (error) {
        console.error("Error fetching station name:", error);
        throw new Error("Failed to fetch station name.");
    }
};

const sanitizeTiming = (timing) => {
    // Ensure the timing string is of the format "HH:MM" and slice if necessary
    return timing.slice(0, 5);
};

const adjustTravelDate = (initialDate, departureTime, lastDate) => {
    const date = new Date(initialDate);
    const [hours, minutes] = sanitizeTiming(departureTime).split(':').map(Number); // Extract hours and minutes correctly

    const departureDateTime = new Date(date);
    departureDateTime.setHours(hours, minutes, 0, 0);

    if (lastDate && departureDateTime <= lastDate) {
        date.setDate(date.getDate() + 1);
    }

    return date.toISOString().split('T')[0];
};

const fetchIntermediateStations = async (trainNumber, originalBoarding, originalDestination, travelDate) => {
    try {
        const boardingStationName = await fetchStationName(originalBoarding);
        const destinationStationName = await fetchStationName(originalDestination);
        console.log("Boarding Station Name:", boardingStationName);
        console.log("Destination Station Name:", destinationStationName);

        if (!boardingStationName || !destinationStationName) {
            throw new Error("Invalid boarding or destination stations.");
        }

        const route = await fetchTrainRoute(trainNumber);

        const startIndex = route.findIndex(station => station.station_name === boardingStationName);
        const endIndex = route.findIndex(station => station.station_name === destinationStationName);
        console.log("Start Index:", startIndex);
        console.log("End Index:", endIndex);

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            throw new Error("Invalid boarding or destination stations.");
        }

        let lastDate = null;

        // Include start and end stations in the list
        const intermediateStations = route.slice(startIndex, endIndex + 1).map((station, index) => {
            const adjustedDate = adjustTravelDate(travelDate, station.timing, lastDate);
            lastDate = new Date(`${adjustedDate}T${sanitizeTiming(station.timing)}:00Z`);

            return {
                name: station.station_name,
                code: stationCodeMap[station.station_name],
                adjusted_date: adjustedDate
            };
        });

        return intermediateStations;
    } catch (error) {
        console.error("Error fetching intermediate stations:", error);
        throw new Error("Failed to fetch intermediate stations.");
    }
};

const fetchTicketAvailability = async (trainNumber, fromStation, toStation, seatType, adjustedTravelDate) => {
    console.log(`Checking availability for train: ${trainNumber}, from: ${fromStation}, to: ${toStation}, class: ${seatType}, date: ${adjustedTravelDate}`);
    const apiUrl = 'https://irctc1.p.rapidapi.com/api/v1/checkSeatAvailability';
    const options = {
        method: 'GET',
        url: apiUrl,
        params: {
            classType: seatType,
            fromStationCode: fromStation,
            quota: 'GN',
            toStationCode: toStation,
            trainNo: trainNumber,
            date: adjustedTravelDate
        },
        headers: {
            'x-rapidapi-host': 'irctc1.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY
        }
    };

    try {
                const response = await axios.request(options);
                console.log(`Response for availability from ${fromStation} to ${toStation}:`, response.data);
        
                if (response.data.status) {
                    // Format adjusted travel date to match entry date format
                    const formattedTravelDate = `${new Date(adjustedTravelDate).getDate()}-${new Date(adjustedTravelDate).getMonth() + 1}-${new Date(adjustedTravelDate).getFullYear()}`;
        
                    // Find availability based on the formatted date
                    const availability = response.data.data.find(entry => {
                        // Format entry date to match the format of formattedTravelDate
                        const entryDateParts = entry.date.split('-').map(part => parseInt(part));
                        const formattedEntryDate = `${entryDateParts[0]}-${entryDateParts[1]}-${entryDateParts[2]}`;
                        return formattedEntryDate === formattedTravelDate;
                    });
        
                    return availability ? availability.current_status : null;
        } else {
            throw new Error("Failed to fetch ticket availability.");
        }
    } catch (error) {
        console.error("Error fetching ticket availability:", error);
        throw new Error("Failed to fetch ticket availability.");
    }
};

const findAlternativeStations = async (trainNumber, originalBoardingCode, originalDestinationCode, seatType, travelDate) => {
    const intermediateStations = await fetchIntermediateStations(trainNumber, originalBoardingCode, originalDestinationCode, travelDate);

    const alternatives = [];

    console.log("Intermediate Stations:", intermediateStations);

    // Check availability for all pairs of intermediate stations including the first and last stations
    for (let i = 0; i < intermediateStations.length - 1; i++) {
        for (let j = i + 1; j < intermediateStations.length; j++) {
            const fromStation = intermediateStations[i];
            const toStation = intermediateStations[j];

            try {
                console.log(`Checking availability from ${fromStation.name} (${fromStation.code}) to ${toStation.name} (${toStation.code}) on date ${fromStation.adjusted_date}`);

                const status = await fetchTicketAvailability(trainNumber, fromStation.code, toStation.code, seatType, fromStation.adjusted_date);

                console.log(`Availability status from ${fromStation.name} to ${toStation.name}:`, status);

                if (status) {
                    alternatives.push({
                        boardingStation: fromStation.name,
                        destinationStation: toStation.name,
                        status
                    });
                } else {
                    console.log(`No availability for ${fromStation.name} to ${toStation.name}`);
                }
            } catch (error) {
                console.error(`Error checking availability for ${fromStation.name} to ${toStation.name}:`, error);
            }
        }
    }

    console.log("Alternatives:", alternatives);

    return alternatives;
};

app.post("/findTickets", async (req, res) => {
    const { trainNumber, boardingStation, destinationStation, seatType, travelDate } = req.body;

    console.log("Received request with data:", req.body);

    try {
        const alternatives = await findAlternativeStations(trainNumber, boardingStation, destinationStation, seatType, travelDate);
        res.json({
            original: { trainNumber, boardingStation, destinationStation, seatType, travelDate },
            alternatives
        });
    } catch (error) {
        console.error("Error finding alternative stations:", error);
        res.status(500).json({ success: false, message: "Error finding alternative stations." });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

