async function fetchReservations() {
    try {
        console.log('Fetching reservations...'); // Log action
        const response = await fetch('/api/reservations');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const reservations = await response.json();
        console.log('Fetched Reservations:', reservations); // Log fetched reservations

        const reservationsList = document.getElementById('reservations-list');
        reservationsList.innerHTML = ''; // Clear the list before adding new items

        if (reservations.length === 0) {
            reservationsList.textContent = 'No reservations found.';
        } else {
            reservations.forEach(reservation => {
                const reservationItem = document.createElement('div');
                // Correctly accessing the reservation object properties
                reservationItem.textContent = `Resource ID: ${reservation.resource_id}, Start Time: ${reservation.start_time}, End Time: ${reservation.end_time}, Purpose: ${reservation.purpose}`;
                reservationsList.appendChild(reservationItem);
            });
        }
    } catch (error) {
        console.error('Error fetching reservations:', error);
        const reservationsList = document.getElementById('reservations-list');
        reservationsList.textContent = 'Error fetching reservations. Please try again later.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed'); // Log DOM load
    fetchReservations();
});
