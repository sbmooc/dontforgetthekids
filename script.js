let children = [];
let adults = [];
let childIdCounter = 0;
let adultIdCounter = 0;
let selectedStartDate = null;
let weekCount = 0;

// URL State Management Functions
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function encodeStateToURL() {
    try {
        const params = new URLSearchParams();
        
        // Simple readable parameters
        if (selectedStartDate) {
            params.set('start', selectedStartDate.toISOString().split('T')[0]);
        }
        
        const dropoffTime = document.getElementById('default-dropoff').value;
        if (dropoffTime) {
            params.set('dropoff', dropoffTime);
        }
        
        const pickupTime = document.getElementById('default-pickup').value;
        if (pickupTime) {
            params.set('pickup', pickupTime);
        }
        
        if (weekCount > 0) {
            params.set('weeks', weekCount.toString());
        }
        
        // Base64 encoded complex data
        if (children.length > 0) {
            const childrenData = {
                children: children,
                counter: childIdCounter
            };
            params.set('children', btoa(JSON.stringify(childrenData)));
        }
        
        if (adults.length > 0) {
            const adultsData = {
                adults: adults,
                counter: adultIdCounter
            };
            params.set('adults', btoa(JSON.stringify(adultsData)));
        }
        
        // Capture schedule selections
        const scheduleData = getTableSelections();
        if (scheduleData.length > 0) {
            params.set('schedule', btoa(JSON.stringify(scheduleData)));
        }
        
        return params.toString();
    } catch (error) {
        console.warn('Error encoding state to URL:', error);
        return '';
    }
}

function decodeStateFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const state = {};
        
        // Decode simple parameters
        if (params.has('start')) {
            state.startDate = params.get('start');
        }
        
        if (params.has('dropoff')) {
            state.dropoffTime = params.get('dropoff');
        }
        
        if (params.has('pickup')) {
            state.pickupTime = params.get('pickup');
        }
        
        if (params.has('weeks')) {
            state.weekCount = parseInt(params.get('weeks'), 10);
        }
        
        // Decode Base64 encoded data
        if (params.has('children')) {
            const childrenData = JSON.parse(atob(params.get('children')));
            state.children = childrenData.children || [];
            state.childIdCounter = childrenData.counter || 0;
        }
        
        if (params.has('adults')) {
            const adultsData = JSON.parse(atob(params.get('adults')));
            state.adults = adultsData.adults || [];
            state.adultIdCounter = adultsData.counter || 0;
        }
        
        if (params.has('schedule')) {
            state.schedule = JSON.parse(atob(params.get('schedule')));
        }
        
        return state;
    } catch (error) {
        console.warn('Error decoding state from URL:', error);
        return {};
    }
}

function updateURL() {
    const urlParams = encodeStateToURL();
    const newURL = urlParams ? `${window.location.pathname}?${urlParams}` : window.location.pathname;
    window.history.replaceState(null, '', newURL);
}

const debouncedUpdateURL = debounce(updateURL, 500);

function getTableSelections() {
    const selections = [];
    const tbody = document.querySelector('#schedule-table tbody');
    if (!tbody) return selections;
    
    const rows = tbody.querySelectorAll('tr');
    let weekIndex = 0;
    let dayIndex = 0;
    
    rows.forEach((row, rowIndex) => {
        const timeCell = row.querySelector('.time-type');
        if (!timeCell) return;
        
        const timeType = timeCell.getAttribute('data-time-type');
        const selects = row.querySelectorAll('.parent-select');
        
        if (selects.length > 0) {
            const assignments = {};
            selects.forEach((select, childIndex) => {
                if (select.value) {
                    assignments[children[childIndex]?.id] = parseInt(select.value);
                }
            });
            
            if (Object.keys(assignments).length > 0) {
                selections.push({
                    week: weekIndex,
                    day: dayIndex,
                    timeType: timeType,
                    assignments: assignments
                });
            }
        }
        
        // Update indices based on row structure
        if (timeType === 'pickup') {
            dayIndex++;
            if (dayIndex >= 5) {
                dayIndex = 0;
                weekIndex++;
            }
        }
    });
    
    return selections;
}

function restoreState(state) {
    try {
        // Restore children
        if (state.children) {
            children = state.children;
            childIdCounter = state.childIdCounter || children.length;
            renderChildren();
        }
        
        // Restore adults
        if (state.adults) {
            adults = state.adults;
            adultIdCounter = state.adultIdCounter || adults.length;
            renderAdults();
        }
        
        // Restore settings
        if (state.startDate) {
            selectedStartDate = new Date(state.startDate);
            document.getElementById('start-date').value = state.startDate;
        }
        
        if (state.dropoffTime) {
            document.getElementById('default-dropoff').value = state.dropoffTime;
        }
        
        if (state.pickupTime) {
            document.getElementById('default-pickup').value = state.pickupTime;
        }
        
        // Restore table if we have all required data
        if (state.weekCount && children.length > 0 && selectedStartDate) {
            weekCount = state.weekCount;
            
            document.getElementById('schedule-table').style.display = 'table';
            document.getElementById('week-controls').style.display = 'block';
            
            updateTableHeaders();
            
            // Add additional weeks if needed
            for (let i = 1; i < weekCount; i++) {
                addNextWeekSilent();
            }
            
            updateDatesInTable();
            updateTimeLabels();
            updateRemoveButtonState();
            
            document.getElementById('create-table-btn').textContent = 'Update Table';
            
            // Restore schedule selections
            if (state.schedule) {
                restoreTableSelections(state.schedule);
            }
        }
    } catch (error) {
        console.warn('Error restoring state:', error);
    }
}

function restoreTableSelections(scheduleData) {
    try {
        const tbody = document.querySelector('#schedule-table tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        let weekIndex = 0;
        let dayIndex = 0;
        
        rows.forEach((row) => {
            const timeCell = row.querySelector('.time-type');
            if (!timeCell) return;
            
            const timeType = timeCell.getAttribute('data-time-type');
            const selects = row.querySelectorAll('.parent-select');
            
            // Find matching schedule entry
            const scheduleEntry = scheduleData.find(entry => 
                entry.week === weekIndex && 
                entry.day === dayIndex && 
                entry.timeType === timeType
            );
            
            if (scheduleEntry && scheduleEntry.assignments) {
                selects.forEach((select, childIndex) => {
                    const childId = children[childIndex]?.id;
                    if (childId && scheduleEntry.assignments[childId]) {
                        select.value = scheduleEntry.assignments[childId];
                    }
                });
            }
            
            // Update indices
            if (timeType === 'pickup') {
                dayIndex++;
                if (dayIndex >= 5) {
                    dayIndex = 0;
                    weekIndex++;
                }
            }
        });
    } catch (error) {
        console.warn('Error restoring table selections:', error);
    }
}

function addNextWeekSilent() {
    const tbody = document.querySelector('#schedule-table tbody');
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    dayNames.forEach((dayName) => {
        // Create dropoff row
        const dropoffRow = document.createElement('tr');
        
        // Day label cell (spans 2 rows)
        const dayCell = document.createElement('td');
        dayCell.className = 'day-label';
        dayCell.setAttribute('rowspan', '2');
        dayCell.setAttribute('data-day', dayName.toLowerCase());
        dropoffRow.appendChild(dayCell);
        
        // Time type cell for dropoff
        const dropoffTimeCell = document.createElement('td');
        dropoffTimeCell.className = 'time-type';
        dropoffTimeCell.setAttribute('data-time-type', 'dropoff');
        dropoffTimeCell.textContent = 'Drop Off';
        dropoffRow.appendChild(dropoffTimeCell);
        
        // Add child columns for dropoff
        children.forEach(() => {
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'parent-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select parent';
            select.appendChild(defaultOption);
            
            // Add options for each adult
            adults.forEach(adult => {
                const option = document.createElement('option');
                option.value = adult.id;
                option.textContent = adult.name;
                select.appendChild(option);
            });
            
            td.appendChild(select);
            dropoffRow.appendChild(td);
        });
        
        tbody.appendChild(dropoffRow);
        
        // Create pickup row
        const pickupRow = document.createElement('tr');
        
        // Time type cell for pickup
        const pickupTimeCell = document.createElement('td');
        pickupTimeCell.className = 'time-type';
        pickupTimeCell.setAttribute('data-time-type', 'pickup');
        pickupTimeCell.textContent = 'Pick Up';
        pickupRow.appendChild(pickupTimeCell);
        
        // Add child columns for pickup
        children.forEach(() => {
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'parent-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select parent';
            select.appendChild(defaultOption);
            
            // Add options for each adult
            adults.forEach(adult => {
                const option = document.createElement('option');
                option.value = adult.id;
                option.textContent = adult.name;
                select.appendChild(option);
            });
            
            td.appendChild(select);
            pickupRow.appendChild(td);
        });
        
        tbody.appendChild(pickupRow);
    });
}

function addChild() {
    const childNameInput = document.getElementById('child-name');
    const childName = childNameInput.value.trim();
    
    if (childName === '') {
        showErrorModal('Please enter a child\'s name');
        return;
    }
    
    const child = {
        id: childIdCounter++,
        name: childName
    };
    
    children.push(child);
    childNameInput.value = '';
    renderChildren();
    
    // Update table if it's visible
    const table = document.getElementById('schedule-table');
    if (table.style.display !== 'none') {
        updateTableHeaders();
    }
    
    // Update URL
    updateURL();
}

function removeChild(childId) {
    children = children.filter(child => child.id !== childId);
    renderChildren();
    
    // Update table if it's visible
    const table = document.getElementById('schedule-table');
    if (table.style.display !== 'none') {
        updateTableHeaders();
    }
    
    // Update URL
    updateURL();
}

function renderChildren() {
    const childrenList = document.getElementById('children-list');
    childrenList.innerHTML = '';
    
    children.forEach(child => {
        const childItem = document.createElement('div');
        childItem.className = 'list-item';
        childItem.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-name">${child.name}</div>
            </div>
            <button data-child-id="${child.id}" class="remove-child-btn remove-x">×</button>
        `;
        childrenList.appendChild(childItem);
    });
}

function addAdult() {
    const adultNameInput = document.getElementById('adult-name');
    const adultName = adultNameInput.value.trim();
    
    if (adultName === '') {
        showErrorModal('Please enter an adult\'s name');
        return;
    }
    
    const adult = {
        id: adultIdCounter++,
        name: adultName,
        emails: []
    };
    
    adults.push(adult);
    adultNameInput.value = '';
    renderAdults();
    
    // Update table dropdowns if table is visible
    const table = document.getElementById('schedule-table');
    if (table.style.display !== 'none') {
        updateTableCells();
    }
    
    // Update URL
    updateURL();
}

function removeAdult(adultId) {
    adults = adults.filter(adult => adult.id !== adultId);
    renderAdults();
    
    // Update table dropdowns if table is visible
    const table = document.getElementById('schedule-table');
    if (table.style.display !== 'none') {
        updateTableCells();
    }
    
    // Update URL
    updateURL();
}

function addEmail(adultId) {
    const emailInput = document.querySelector(`#email-input-${adultId}`);
    const email = emailInput.value.trim();
    
    if (email === '') {
        showErrorModal('Please enter an email address');
        return;
    }
    
    if (!isValidEmail(email)) {
        showErrorModal('Please enter a valid email address');
        return;
    }
    
    const adult = adults.find(a => a.id === adultId);
    if (adult && !adult.emails.includes(email)) {
        adult.emails.push(email);
        emailInput.value = '';
        renderAdults();
        debouncedUpdateURL();
    }
}

function removeEmail(adultId, email) {
    const adult = adults.find(a => a.id === adultId);
    if (adult) {
        adult.emails = adult.emails.filter(e => e !== email);
        renderAdults();
        debouncedUpdateURL();
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function renderAdults() {
    const adultsList = document.getElementById('adults-list');
    adultsList.innerHTML = '';
    
    adults.forEach(adult => {
        const adultItem = document.createElement('div');
        adultItem.className = 'list-item';
        
        const emailTags = adult.emails.map(email => 
            `<span class="email-tag">
                ${email}
                <button data-adult-id="${adult.id}" data-email="${email}" class="email-remove remove-email-btn">×</button>
            </span>`
        ).join('');
        
        adultItem.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-name">${adult.name}</div>
                <div class="email-list">${emailTags}</div>
                <div class="add-email-form">
                    <input type="email" id="email-input-${adult.id}" placeholder="Add email address" class="input-field">
                    <button data-adult-id="${adult.id}" class="btn btn-secondary add-email-btn">Add Email</button>
                </div>
            </div>
            <button data-adult-id="${adult.id}" class="remove-adult-btn remove-x">×</button>
        `;
        adultsList.appendChild(adultItem);
    });
}

function createTable() {
    if (children.length === 0) {
        showErrorModal('Please add at least one child before creating the table');
        return;
    }
    
    if (adults.length === 0) {
        showErrorModal('Please add at least one adult before creating the table');
        return;
    }
    
    const startDateInput = document.getElementById('start-date');
    if (!startDateInput.value) {
        showErrorModal('Please select a start date for the schedule');
        return;
    }
    
    selectedStartDate = new Date(startDateInput.value);
    
    document.getElementById('schedule-table').style.display = 'table';
    document.getElementById('week-controls').style.display = 'block';
    weekCount = 1;
    updateTableHeaders();
    updateDatesInTable();
    updateRemoveButtonState();
    document.getElementById('create-table-btn').textContent = 'Update Table';
    
    // Update URL
    updateURL();
}

function updateTableHeaders() {
    const table = document.querySelector('#schedule-table');
    const thead = table.querySelector('thead tr');
    
    // Clear existing headers except Day and Time
    const existingHeaders = thead.querySelectorAll('th');
    for (let i = existingHeaders.length - 1; i >= 2; i--) {
        existingHeaders[i].remove();
    }
    
    // Add child headers
    children.forEach(child => {
        const th = document.createElement('th');
        th.textContent = child.name;
        thead.appendChild(th);
    });
    
    // Update table body cells
    updateTableCells();
}

function updateTableCells() {
    const tbody = document.querySelector('#schedule-table tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        // Determine how many cells to keep based on row structure
        const hasDayLabel = row.querySelector('.day-label');
        const hasTimeType = row.querySelector('.time-type');
        
        // Remove existing child cells (keep Day and Time columns)
        const existingCells = row.querySelectorAll('td');
        const cellsToKeep = hasDayLabel && hasTimeType ? 2 : 1; // Drop-off rows have both, pickup rows only have time-type
        
        for (let i = existingCells.length - 1; i >= cellsToKeep; i--) {
            existingCells[i].remove();
        }
        
        // Add dropdown cells for each child (for parent assignment)
        children.forEach(child => {
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'parent-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select parent';
            select.appendChild(defaultOption);
            
            // Add options for each adult
            adults.forEach(adult => {
                const option = document.createElement('option');
                option.value = adult.id;
                option.textContent = adult.name;
                select.appendChild(option);
            });
            
            td.appendChild(select);
            row.appendChild(td);
        });
    });
    
    // Update time labels after updating cells
    updateTimeLabels();
}

function addNextWeek() {
    const tbody = document.querySelector('#schedule-table tbody');
    const existingRows = tbody.querySelectorAll('tr');
    
    // Store current week's selections
    const currentSelections = [];
    existingRows.forEach(row => {
        const selects = row.querySelectorAll('.parent-select');
        const rowSelections = Array.from(selects).map(select => select.value);
        currentSelections.push(rowSelections);
    });
    
    // Add new week rows
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    dayNames.forEach((dayName, dayIndex) => {
        // Create dropoff row
        const dropoffRow = document.createElement('tr');
        
        // Day label cell (spans 2 rows)
        const dayCell = document.createElement('td');
        dayCell.className = 'day-label';
        dayCell.setAttribute('rowspan', '2');
        dayCell.setAttribute('data-day', dayName.toLowerCase());
        dropoffRow.appendChild(dayCell);
        
        // Time type cell for dropoff
        const dropoffTimeCell = document.createElement('td');
        dropoffTimeCell.className = 'time-type';
        dropoffTimeCell.setAttribute('data-time-type', 'dropoff');
        dropoffTimeCell.textContent = 'Drop Off';
        dropoffRow.appendChild(dropoffTimeCell);
        
        // Add child columns for dropoff
        children.forEach((child, childIndex) => {
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'parent-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select parent';
            select.appendChild(defaultOption);
            
            // Add options for each adult
            adults.forEach(adult => {
                const option = document.createElement('option');
                option.value = adult.id;
                option.textContent = adult.name;
                select.appendChild(option);
            });
            
            // Copy selection from previous week
            const prevWeekRowIndex = dayIndex * 2; // dropoff row index
            if (currentSelections[prevWeekRowIndex] && currentSelections[prevWeekRowIndex][childIndex]) {
                select.value = currentSelections[prevWeekRowIndex][childIndex];
            }
            
            td.appendChild(select);
            dropoffRow.appendChild(td);
        });
        
        tbody.appendChild(dropoffRow);
        
        // Create pickup row
        const pickupRow = document.createElement('tr');
        
        // Time type cell for pickup
        const pickupTimeCell = document.createElement('td');
        pickupTimeCell.className = 'time-type';
        pickupTimeCell.setAttribute('data-time-type', 'pickup');
        pickupTimeCell.textContent = 'Pick Up';
        pickupRow.appendChild(pickupTimeCell);
        
        // Add child columns for pickup
        children.forEach((child, childIndex) => {
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'parent-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select parent';
            select.appendChild(defaultOption);
            
            // Add options for each adult
            adults.forEach(adult => {
                const option = document.createElement('option');
                option.value = adult.id;
                option.textContent = adult.name;
                select.appendChild(option);
            });
            
            // Copy selection from previous week
            const prevWeekRowIndex = dayIndex * 2 + 1; // pickup row index
            if (currentSelections[prevWeekRowIndex] && currentSelections[prevWeekRowIndex][childIndex]) {
                select.value = currentSelections[prevWeekRowIndex][childIndex];
            }
            
            td.appendChild(select);
            pickupRow.appendChild(td);
        });
        
        tbody.appendChild(pickupRow);
    });
    
    weekCount++;
    updateDatesInTable();
    updateTimeLabels();
    updateRemoveButtonState();
    updateURL();
}

function removeWeek() {
    if (weekCount <= 1) {
        showErrorModal('Cannot remove the last week. At least one week must remain.');
        return;
    }
    
    const tbody = document.querySelector('#schedule-table tbody');
    const allRows = tbody.querySelectorAll('tr');
    
    // Remove the last 10 rows (5 days × 2 rows per day)
    const rowsToRemove = Math.min(10, allRows.length);
    for (let i = 0; i < rowsToRemove; i++) {
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
            tbody.removeChild(lastRow);
        }
    }
    
    weekCount--;
    updateDatesInTable();
    updateRemoveButtonState();
    updateURL();
}

function updateRemoveButtonState() {
    const removeBtn = document.getElementById('remove-week-btn');
    if (removeBtn) {
        removeBtn.disabled = weekCount <= 1;
        if (weekCount <= 1) {
            removeBtn.classList.add('btn-disabled');
        } else {
            removeBtn.classList.remove('btn-disabled');
        }
    }
}

function updateDatesInTable() {
    if (!selectedStartDate) return;
    
    const dayLabels = document.querySelectorAll('.day-label');
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    // Find the first Monday of the selected week
    const startDate = new Date(selectedStartDate);
    const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    
    // If selected date is already Monday, use it; otherwise find next Monday
    if (dayOfWeek !== 1) {
        startDate.setDate(startDate.getDate() + daysToMonday);
    }
    
    dayLabels.forEach((label, index) => {
        const weekNumber = Math.floor(index / 5);  // Which week (0, 1, 2, ...)
        const dayInWeek = index % 5;  // Which day in the week (0-4)
        
        const dayName = dayNames[dayInWeek];
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (weekNumber * 7) + dayInWeek);
        
        const formattedDate = currentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        
        const dayNameCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        label.innerHTML = `${dayNameCapitalized}<br><small>${formattedDate}</small>`;
    });
}

function updateTimeLabels() {
    // Only update if table is visible
    const table = document.getElementById('schedule-table');
    if (table.style.display === 'none') {
        return;
    }
    
    const tbody = document.querySelector('#schedule-table tbody');
    const rows = tbody.querySelectorAll('tr');
    
    // Get current default times
    const defaultDropoff = document.getElementById('default-dropoff').value || '08:30';
    const defaultPickup = document.getElementById('default-pickup').value || '15:30';
    
    rows.forEach(row => {
        // Update time labels
        const timeCell = row.querySelector('.time-type');
        if (timeCell) {
            const timeType = timeCell.getAttribute('data-time-type');
            if (timeType === 'dropoff') {
                timeCell.textContent = `Drop Off (${defaultDropoff})`;
            } else if (timeType === 'pickup') {
                timeCell.textContent = `Pick Up (${defaultPickup})`;
            }
        }
    });
}

// Handle Enter key for input fields and event delegation
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').setAttribute('min', today);
    
    // Load state from URL if present
    const urlState = decodeStateFromURL();
    if (Object.keys(urlState).length > 0) {
        restoreState(urlState);
    }
    
    // Add event listener for date change
    document.getElementById('start-date').addEventListener('change', function() {
        if (selectedStartDate) {
            selectedStartDate = new Date(this.value);
            updateDatesInTable();
        }
        updateURL();
    });
    
    document.getElementById('child-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addChild();
        }
    });
    
    document.getElementById('adult-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addAdult();
        }
    });
    
    // Add event listeners for default time changes
    document.getElementById('default-dropoff').addEventListener('change', function() {
        updateTimeLabels();
        updateURL();
    });
    
    document.getElementById('default-pickup').addEventListener('change', function() {
        updateTimeLabels();
        updateURL();
    });
    
    // Delegate event handling for dynamically created email inputs
    document.addEventListener('keypress', function(e) {
        if (e.target.id && e.target.id.startsWith('email-input-') && e.key === 'Enter') {
            const adultId = parseInt(e.target.id.split('-')[2]);
            addEmail(adultId);
        }
    });
    
    // Event delegation for dynamically created buttons
    document.addEventListener('click', function(e) {
        // Handle remove child buttons
        if (e.target.classList.contains('remove-child-btn')) {
            const childId = parseInt(e.target.getAttribute('data-child-id'));
            removeChild(childId);
        }
        
        // Handle remove adult buttons
        if (e.target.classList.contains('remove-adult-btn')) {
            const adultId = parseInt(e.target.getAttribute('data-adult-id'));
            removeAdult(adultId);
        }
        
        // Handle add email buttons
        if (e.target.classList.contains('add-email-btn')) {
            const adultId = parseInt(e.target.getAttribute('data-adult-id'));
            addEmail(adultId);
        }
        
        // Handle remove email buttons
        if (e.target.classList.contains('remove-email-btn')) {
            const adultId = parseInt(e.target.getAttribute('data-adult-id'));
            const email = e.target.getAttribute('data-email');
            removeEmail(adultId, email);
        }
    });
    
    // Handle dropdown changes in schedule table
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('parent-select')) {
            debouncedUpdateURL();
        }
    });
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', function() {
        const urlState = decodeStateFromURL();
        if (Object.keys(urlState).length > 0) {
            restoreState(urlState);
        }
    });
});

function shareSchedule() {
    try {
        const currentURL = window.location.href;
        
        if (navigator.clipboard && window.isSecureContext) {
            // Use modern clipboard API
            navigator.clipboard.writeText(currentURL).then(() => {
                showShareFeedback('Schedule URL copied to clipboard!');
            }).catch(() => {
                fallbackCopyToClipboard(currentURL);
            });
        } else {
            // Fallback for older browsers or non-HTTPS
            fallbackCopyToClipboard(currentURL);
        }
    } catch (error) {
        console.warn('Error sharing schedule:', error);
        showShareFeedback('Unable to copy URL. Please copy manually from address bar.');
    }
}

function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showShareFeedback('Schedule URL copied to clipboard!');
        } else {
            showShareFeedback('Unable to copy URL. Please copy manually from address bar.');
        }
    } catch (error) {
        showShareFeedback('Unable to copy URL. Please copy manually from address bar.');
    }
}

function showShareFeedback(message) {
    const button = document.getElementById('share-schedule-btn');
    const originalText = button.textContent;
    
    button.textContent = '✓ Copied!';
    button.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
    }, 2000);
}

// Modal Functions
function showErrorModal(message) {
    const modal = document.getElementById('error-modal');
    const messageElement = document.getElementById('error-message');
    
    messageElement.textContent = message;
    modal.style.display = 'flex';
    
    // Focus the OK button for keyboard accessibility
    setTimeout(() => {
        const okButton = modal.querySelector('.btn');
        if (okButton) okButton.focus();
    }, 100);
}

function closeModal() {
    const modal = document.getElementById('error-modal');
    modal.style.display = 'none';
}

// Close modal when clicking outside of it
document.addEventListener('click', function(e) {
    const errorModal = document.getElementById('error-modal');
    const confirmModal = document.getElementById('confirm-modal');
    
    if (e.target === errorModal) {
        closeModal();
    } else if (e.target === confirmModal) {
        closeConfirmModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const errorModal = document.getElementById('error-modal');
        const confirmModal = document.getElementById('confirm-modal');
        
        if (errorModal.style.display === 'flex') {
            closeModal();
        } else if (confirmModal.style.display === 'flex') {
            closeConfirmModal();
        }
    }
});

// Reset Functions
function resetEverything() {
    // Show confirmation modal
    const modal = document.getElementById('confirm-modal');
    modal.style.display = 'flex';
    
    // Focus the Cancel button for safety
    setTimeout(() => {
        const cancelButton = modal.querySelector('.btn-secondary');
        if (cancelButton) cancelButton.focus();
    }, 100);
}

function confirmReset() {
    // Clear all data
    children = [];
    adults = [];
    childIdCounter = 0;
    adultIdCounter = 0;
    selectedStartDate = null;
    weekCount = 0;
    
    // Clear UI elements
    document.getElementById('children-list').innerHTML = '';
    document.getElementById('adults-list').innerHTML = '';
    document.getElementById('start-date').value = '';
    document.getElementById('default-dropoff').value = '08:30';
    document.getElementById('default-pickup').value = '15:30';
    
    // Hide table and controls
    document.getElementById('schedule-table').style.display = 'none';
    document.getElementById('week-controls').style.display = 'none';
    document.getElementById('create-table-btn').textContent = 'Create Schedule Table';
    
    // Clear URL parameters
    window.history.replaceState(null, '', window.location.pathname);
    
    // Close modal
    closeConfirmModal();
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.style.display = 'none';
}
