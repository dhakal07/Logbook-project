// Function to fetch reservations data and display it
async function fetchReservations() {
  try {
    console.log('Fetching reservations...');
    const response = await fetch('/api/reservations');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched Data:', data); // Log fetched reservations

    // Get the table body element where we'll display the reservations
    const reservationList = document.getElementById('reservation-list');
    
    // Clear any existing rows
    reservationList.innerHTML = '';

    // Check if reservations are available
    if (data.length === 0) {
      reservationList.innerHTML = '<tr><td colspan="4">No reservations found.</td></tr>';
      return;
    }
    
    // Loop through the data and create table rows
    data.forEach(reservation => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${reservation.resource_id || 'N/A'}</td>
        <td>${new Date(reservation.start_time).toLocaleString() || 'N/A'}</td>
        <td>${new Date(reservation.end_time).toLocaleString() || 'N/A'}</td>
        <td>${reservation.purpose || 'N/A'}</td>
      `;
      reservationList.appendChild(row);
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);

    // Handle errors by displaying a message in the table
    const reservationList = document.getElementById('reservation-list');
    reservationList.innerHTML = '<tr><td colspan="4">Error fetching reservations. Please try again later.</td></tr>';
  }
}

// Call the function to fetch and display the reservations when the page loads
window.onload = () => {
  fetchReservations();
};
