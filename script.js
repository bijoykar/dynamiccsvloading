let csvData = [];
let filteredData = [];
let headers = [];

$(document).ready(function() {
    loadCSVData();
});

function loadCSVData() {
    // Load CSV data directly from file
    $.get('sample_data.csv')
        .done(function(data) {
            try {
                parseCSV(data);
                createFilterInputs();
                displayData(csvData);
                updateStats();
                $('#loading').hide();
                $('#tableContainer').show();
            } catch (error) {
                $('#loading').html('<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> Error processing CSV data: ' + error.message + '</div>');
            }
        })
        .fail(function(xhr, status, error) {
            $('#loading').html(`
                <div class="alert alert-warning">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Note:</strong> Unable to load CSV file directly due to browser security restrictions (CORS policy).<br>
                    <strong>Solutions:</strong>
                    <ul class="mt-2 mb-0">
                        <li>Use the "Load CSV File" button above to upload your CSV file directly</li>
                        <li>Or serve this page from a local web server (e.g., using VS Code Live Server extension)</li>
                        <li>Or open the file directly in a web browser that allows local file access</li>
                    </ul>
                </div>
            `);
        });
}

function parseCSV(data) {
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    // Parse headers and remove empty ones caused by trailing commas
    headers = lines[0].split(',')
        .map(header => header.trim())
        .filter(header => header !== '');
    
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => {
            const trimmed = value.trim();
            // Normalize null, undefined, empty strings, and common null representations
            if (trimmed === '' || trimmed.toLowerCase() === 'null' || 
                trimmed.toLowerCase() === 'undefined' || trimmed === 'N/A' || 
                trimmed === 'n/a' || trimmed === '-') {
                return '';
            }
            return trimmed;
        });
        
        // Remove trailing empty values to match header count
        while (values.length > 0 && values[values.length - 1] === '') {
            values.pop();
        }
        
        // Accept rows that match header count or are close (allow some flexibility)
        if (values.length === headers.length || values.length === headers.length - 1) {
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // Convert specific columns to decimal format (divide by 10)
                const decimalColumns = ['VOLTAGE', 'VFD_RUNNING_FRQ', 'VFD_CURRENT'];
                if (decimalColumns.some(col => header.toUpperCase().includes(col)) && value !== '') {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        value = (numValue / 10).toFixed(2);
                    }
                }
                
                row[header] = value;
            });
            csvData.push(row);
        }
    }
    filteredData = [...csvData];
}

function createFilterInputs() {
    // Check if Shift column exists
    const shiftColumn = headers.find(h => h.toLowerCase() === 'shift');
    
    if (shiftColumn) {
        const uniqueShifts = [...new Set(csvData.map(row => row[shiftColumn] || '(Empty)'))]
            .sort((a, b) => {
                if (a === '(Empty)') return 1;
                if (b === '(Empty)') return -1;
                return a.localeCompare(b);
            });
        
        const shiftSelect = $('#shiftFilter');
        shiftSelect.empty();
        shiftSelect.append('<option value="">All Shifts</option>');
        
        uniqueShifts.forEach(value => {
            const displayValue = value === '(Empty)' ? '(Empty)' : value;
            const actualValue = value === '(Empty)' ? '' : value;
            shiftSelect.append(`<option value="${actualValue}">${displayValue}</option>`);
        });
    }

    // Check if Mode column exists
    const modeColumn = headers.find(h => h.toLowerCase() === 'vfd_mode_status' || h === 'VFD_MODE_STATUS');
    
    if (modeColumn) {
        const uniqueModes = [...new Set(csvData.map(row => row[modeColumn] || '(Empty)'))]
            .sort((a, b) => {
                if (a === '(Empty)') return 1;
                if (b === '(Empty)') return -1;
                return a.localeCompare(b);
            });
        
        const modeSelect = $('#modeFilter');
        modeSelect.empty();
        modeSelect.append('<option value="">All Modes</option>');
        
        uniqueModes.forEach(value => {
            const displayValue = value === '(Empty)' ? '(Empty)' : value;
            const actualValue = value === '(Empty)' ? '' : value;
            modeSelect.append(`<option value="${actualValue}">${displayValue}</option>`);
        });
    }

    // Add event listeners for filters
    $('#fromDate, #toDate, #shiftFilter, #modeFilter').on('change', applyFilters);
    
    // Populate date dropdowns from CSV data
    const dateColumn = headers.find(h => h.toLowerCase().includes('date'));
    if (dateColumn) {
        const uniqueDates = [...new Set(csvData.map(row => row[dateColumn]))]
            .filter(date => date && date.trim() !== '')
            .sort((a, b) => {
                // Parse and compare dates DD/MM/YY format
                const parseDate = (dateStr) => {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        return new Date('20' + parts[2], parts[1] - 1, parts[0]);
                    }
                    return new Date(0);
                };
                return parseDate(a) - parseDate(b);
            });
        
        const fromDateSelect = $('#fromDate');
        const toDateSelect = $('#toDate');
        
        fromDateSelect.empty().append('<option value="">Select From Date</option>');
        toDateSelect.empty().append('<option value="">Select To Date</option>');
        
        uniqueDates.forEach(date => {
            fromDateSelect.append(`<option value="${date}">${date}</option>`);
            toDateSelect.append(`<option value="${date}">${date}</option>`);
        });
        
        // Set default values to first and last date
        if (uniqueDates.length > 0) {
            fromDateSelect.val(uniqueDates[0]);
            toDateSelect.val(uniqueDates[uniqueDates.length - 1]);
        }
    }
}

function applyFilters() {
    const fromDate = $('#fromDate').val();
    const toDate = $('#toDate').val();
    const shiftValue = $('#shiftFilter').val();
    const modeValue = $('#modeFilter').val();
    
    // Find date, shift, and mode columns (case-insensitive)
    const dateColumn = headers.find(h => h.toLowerCase().includes('date'));
    const shiftColumn = headers.find(h => h.toLowerCase() === 'shift');
    const modeColumn = headers.find(h => h.toLowerCase() === 'vfd_mode_status' || h === 'VFD_MODE_STATUS');
    
    filteredData = csvData.filter(row => {
        // Filter by date range
        if (dateColumn && (fromDate || toDate)) {
            const rowDate = row[dateColumn];
            if (rowDate) {
                // Parse date for comparison - DD/MM/YY format
                const parseDate = (dateStr) => {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        return new Date('20' + parts[2], parts[1] - 1, parts[0]);
                    }
                    return new Date(0);
                };
                
                const currentDate = parseDate(rowDate);
                
                if (fromDate) {
                    const startDate = parseDate(fromDate);
                    if (currentDate < startDate) return false;
                }
                
                if (toDate) {
                    const endDate = parseDate(toDate);
                    if (currentDate > endDate) return false;
                }
            }
        }
        
        // Filter by shift
        if (shiftColumn && shiftValue !== '') {
            if (row[shiftColumn] !== shiftValue) return false;
        }
        
        // Filter by mode
        if (modeColumn && modeValue !== '') {
            if (row[modeColumn] !== modeValue) return false;
        }
        
        return true;
    });

    displayData(filteredData);
    updateStats();
}

function displayData(data) {
    const tableHead = $('#tableHead');
    const tableBody = $('#tableBody');

    // Clear existing content
    tableHead.empty();
    tableBody.empty();

    if (data.length === 0) {
        $('#tableContainer').hide();
        $('#topScroll').hide();
        $('#noData').show();
        return;
    }

    $('#noData').hide();
    $('#tableContainer').show();
    $('#topScroll').show();

    // Create header row
    const headerRow = $('<tr></tr>');
    headers.forEach(header => {
        headerRow.append(`<th>${header}</th>`);
    });
    tableHead.append(headerRow);

    // Create data rows
    data.forEach(row => {
        const dataRow = $('<tr></tr>');
        headers.forEach(header => {
            const value = row[header];
            // Display empty values with a visual indicator
            const displayValue = (value === '' || value === null || value === undefined) 
                ? '<span style="color: #999; font-style: italic;">-</span>' 
                : value;
            dataRow.append(`<td>${displayValue}</td>`);
        });
        tableBody.append(dataRow);
    });

    // Sync scrollbars
    syncScrollbars();
}

function updateStats() {
    $('#totalRecords').text(csvData.length);
    $('#filteredRecords').text(filteredData.length);
    $('#columnsCount').text(headers.length);
}

function syncScrollbars() {
    const tableContainer = $('#tableContainer');
    const topScroll = $('#topScroll');
    const topScrollContent = $('#topScrollContent');
    
    // Set the width of the dummy div to match the table width
    const tableWidth = $('#dataTable').outerWidth();
    topScrollContent.width(tableWidth);
    
    // Sync scroll positions
    topScroll.off('scroll').on('scroll', function() {
        tableContainer.scrollLeft($(this).scrollLeft());
    });
    
    tableContainer.off('scroll').on('scroll', function() {
        topScroll.scrollLeft($(this).scrollLeft());
    });
}

function downloadCSV(data, filename) {
    if (data.length === 0) {
        alert('No data to download!');
        return;
    }

    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header];
            // Handle null, undefined, and empty values
            if (value === null || value === undefined || value === '') {
                return '';
            }
            // Convert to string if not already
            value = String(value);
            // Escape quotes and wrap in quotes if necessary
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event handlers
$('#downloadFiltered').on('click', function() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadCSV(filteredData, `filtered_data_${timestamp}.csv`);
});

$('#clearFilters').on('click', function() {
    $('#fromDate').val('');
    $('#toDate').val('');
    $('#shiftFilter').val('');
    $('#modeFilter').val('');
    filteredData = [...csvData];
    displayData(filteredData);
    updateStats();
});

// File upload handler
$('#csvFileInput').on('change', function(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                $('#loading').show();
                $('#tableContainer').hide();
                parseCSV(e.target.result);
                createFilterInputs();
                displayData(csvData);
                updateStats();
                $('#loading').hide();
                $('#tableContainer').show();
            } catch (error) {
                $('#loading').html('<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> Error processing uploaded CSV: ' + error.message + '</div>');
            }
        };
        reader.readAsText(file);
    } else {
        alert('Please select a valid CSV file.');
    }
});
