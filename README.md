# Railway-Seat-Availability

# Train Ticket Availability

This repository contains a web application for finding alternative train stations for confirmed tickets. It helps users to search for alternative boarding and destination stations if their desired train route is fully booked.

## Features

- **Search Form**: Users can input the train number, original boarding station, original destination station, seat type, and travel date.
- **Results Display**: The application displays a table of alternative boarding and destination stations along with their availability status.
- **Responsive Design**: The interface is designed to be responsive and compatible with various devices.

## Technologies Used

- **Frontend**:
  - HTML
  - CSS (styles.css)
  - Bootstrap 4
  - JavaScript (jQuery)

- **Backend**:
  - Node.js
  - Express.js
  - Axios

## Setup

1. Clone the repository:

2. Navigate to the project directory:
cd train-ticket-availability


3. Install dependencies:
npm install


4. Create a `.env` file in the root directory and add your RapidAPI key:
RAPIDAPI_KEY=your_rapidapi_key_here
Replace `your_rapidapi_key_here` with your actual RapidAPI key.

5. Start the server:
node app.js


6. Open a web browser and go to `http://localhost:3000` to access the application.

## Usage

1. Fill out the search form with the required details:
   - Train Number
   - Original Boarding Station
   - Original Destination Station
   - Seat Type
   - Date of Travel

2. Click on the "Find Tickets" button.

3. The application will display alternative boarding and destination stations along with their availability status.

## Contributions

Contributions are welcome! If you want to contribute to this project, feel free to open a pull request.


