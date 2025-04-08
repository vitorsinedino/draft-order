// /extensions/your-extension-name/assets/list-draft-orders.js

(function() {
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[Theme Extension] Initializing draft orders list');
      
      const draftOrderList = document.getElementById('draft-order-list');
      const loadingDiv = document.getElementById('draft-orders-loading');
      const containerDiv = document.getElementById('draft-orders-container');
      const errorDiv = document.getElementById('draft-orders-error');
      const noDraftOrdersDiv = document.getElementById('no-draft-orders');
      const refreshBtn = document.getElementById('refresh-draft-orders-btn');
      
      if (!draftOrderList) {
        console.error('[Theme Extension] Draft order list element not found');
        return;
      }
      
      const shopDomain = draftOrderList.dataset.shop;
      console.log(`[Theme Extension] Setup complete for shop: ${shopDomain}`);
      
      // Function to format date
      function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
      
      // Function to format price
      function formatPrice(price) {
        return parseFloat(price).toFixed(2);
      }
      
      // Function to render draft orders
      function renderDraftOrders(draftOrders) {
        if (!draftOrders || draftOrders.length === 0) {
          loadingDiv.style.display = 'none';
          containerDiv.style.display = 'none';
          noDraftOrdersDiv.style.display = 'block';
          return;
        }
        
        // Clear container and show it
        containerDiv.innerHTML = '';
        loadingDiv.style.display = 'none';
        containerDiv.style.display = 'block';
        noDraftOrdersDiv.style.display = 'none';
        
        // Create table element
        const table = document.createElement('table');
        table.className = 'draft-orders-table';
        
        // Create table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Status</th>
            <th>Total</th>
            <th>Items</th>
            <th>Actions</th>
          </tr>
        `;
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Add each draft order as a row
        draftOrders.forEach(order => {
          const tr = document.createElement('tr');
          
          // Format line items for display
          const lineItemsText = order.lineItems.map(item => 
            `${item.quantity} x ${item.productTitle || item.title}`
          ).join(', ');
          
          tr.innerHTML = `
            <td>${order.name}</td>
            <td>${formatDate(order.createdAt)}</td>
            <td>${order.status}</td>
            <td>${formatPrice(order.totalPrice)}</td>
            <td>${lineItemsText}</td>
            <td>
              <button class="cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>
            </td>
          `;
          
          // Add click event to show more details
          tr.addEventListener('click', function() {
            // Toggle expanded class
            const isExpanded = tr.classList.contains('expanded');
            
            // Remove expanded class from all rows
            const expandedRows = tbody.querySelectorAll('tr.expanded');
            expandedRows.forEach(row => row.classList.remove('expanded'));
            
            // Remove all detail rows
            const detailRows = tbody.querySelectorAll('tr.detail-row');
            detailRows.forEach(row => row.remove());
            
            // If row wasn't expanded before, add expanded class and insert detail row
            if (!isExpanded) {
              tr.classList.add('expanded');
              
              // Create detail row
              const detailRow = document.createElement('tr');
              detailRow.className = 'detail-row';
              
              // Create detail content
              const detailContent = document.createElement('td');
              detailContent.colSpan = 6;
              detailContent.className = 'order-details';
              
              // Populate detail content
              let customerInfo = '';
              if (order.customer) {
                customerInfo = `
                  <div class="customer-info">
                    <h4>Customer</h4>
                    <p>${order.customer.firstName} ${order.customer.lastName}</p>
                    <p>${order.customer.email}</p>
                  </div>
                `;
              }
              
              const itemsList = order.lineItems.map(item => 
                `<li>${item.quantity} x ${item.productTitle || item.title}${item.variantTitle ? ` (${item.variantTitle})` : ''}</li>`
              ).join('');
              
              detailContent.innerHTML = `
                <div class="order-details-content">
                  ${customerInfo}
                  <div class="items-info">
                    <h4>Items</h4>
                    <ul>${itemsList}</ul>
                  </div>
                </div>
              `;
              
              detailRow.appendChild(detailContent);
              
              // Insert detail row after current row
              tr.parentNode.insertBefore(detailRow, tr.nextSibling);
            }
          });
          
          tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        containerDiv.appendChild(table);
        
        // Add event listeners to cancel buttons
        const cancelButtons = containerDiv.querySelectorAll('.cancel-order-btn');
        cancelButtons.forEach(button => {
          button.addEventListener('click', function(event) {
            // Prevent the event from bubbling up to the row click handler
            event.stopPropagation();
            
            const orderId = button.getAttribute('data-order-id');
            const orderName = button.closest('tr').querySelector('td:first-child').textContent;
            console.log(`[Theme Extension] Cancel button clicked for order ID: ${orderId}`);
            
            // Ask for confirmation before cancelling
            if (confirm(`Are you sure you want to cancel draft order ${orderName}? This action cannot be undone.`)) {
              // Show loading state on the button
              const originalText = button.textContent;
              button.textContent = 'Cancelling...';
              button.disabled = true;
              
              // Send cancel request to the app proxy
              const apiUrl = `/apps/draft-order/cancel?shop=${shopDomain}`;
              
              fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  orderId: orderId
                })
              })
              .then(response => {
                console.log(`[Theme Extension] Cancel response status: ${response.status}`);
                
                // Get the raw text to debug any issues
                return response.text().then(text => {
                  console.log('[Theme Extension] Raw cancel response:', text);
                  try {
                    return JSON.parse(text);
                  } catch (error) {
                    console.error('[Theme Extension] Failed to parse cancel response as JSON:', error);
                    throw new Error('Server returned an invalid JSON response');
                  }
                });
              })
              .then(data => {
                console.log('[Theme Extension] Cancel response:', data);
                
                if (data.success) {
                  // Show success message
                  alert(`Order ${orderName} has been cancelled successfully`);
                  
                  // Remove the row from the table
                  const row = button.closest('tr');
                  
                  // Also remove detail row if it exists
                  if (row.nextElementSibling && row.nextElementSibling.classList.contains('detail-row')) {
                    row.nextElementSibling.remove();
                  }
                  
                  row.remove();
                  
                  // Check if there are any orders left
                  if (tbody.querySelectorAll('tr:not(.detail-row)').length === 0) {
                    loadingDiv.style.display = 'none';
                    containerDiv.style.display = 'none';
                    noDraftOrdersDiv.style.display = 'block';
                  }
                } else {
                  // Show error and reset button
                  alert(`Error cancelling order: ${data.error || 'Unknown error'}`);
                  button.textContent = originalText;
                  button.disabled = false;
                }
              })
              .catch(error => {
                console.error('[Theme Extension] Error cancelling order:', error);
                alert(`Error: ${error.message}`);
                button.textContent = originalText;
                button.disabled = false;
              });
            }
          });
        });
      }
      
      // Function to fetch draft orders
      function fetchDraftOrders() {
        // Show loading
        loadingDiv.style.display = 'block';
        containerDiv.style.display = 'none';
        errorDiv.style.display = 'none';
        noDraftOrdersDiv.style.display = 'none';
        
        console.log('[Theme Extension] Current URL:', window.location.href);
        console.log('[Theme Extension] Search params:', window.location.search);
        
        // Get customer ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const customerId = urlParams.get('logged_in_customer_id');
        console.log('[Theme Extension] Customer ID from URL params:', customerId);
        
        // Try to get customer ID from other sources
        const customerIdFromPage = window.meta?.page?.customerId || '';
        console.log('[Theme Extension] Customer ID from meta.page:', customerIdFromPage);
        
        // Try to get customer ID from Shopify object (set by our snippet)
        const shopifyCustomerId = window.Shopify?.customer?.id || '';
        console.log('[Theme Extension] Customer ID from Shopify.customer:', shopifyCustomerId);
        
        // Try to get customer ID from data attribute
        const dataCustomerId = draftOrderList.dataset.customerId || '';
        console.log('[Theme Extension] Customer ID from data attribute:', dataCustomerId);
        
        // Check if customer is logged in according to Shopify
        console.log('[Theme Extension] Customer logged in status:', window.Shopify?.customerPrivacy?.isLoggedIn || 'unknown');
        
        // Final customer ID to use (try all possible sources)
        const finalCustomerId = customerId || shopifyCustomerId || dataCustomerId || customerIdFromPage;
        console.log('[Theme Extension] Final customer ID to use:', finalCustomerId);
        
        if (!finalCustomerId) {
          // No customer ID, show error
          console.error('[Theme Extension] No customer ID found in URL or page metadata');
          errorDiv.innerHTML = 'You need to be logged in to view your draft orders.';
          loadingDiv.style.display = 'none';
          errorDiv.style.display = 'block';
          return;
        }
        
        console.log('[Theme Extension] Fetching draft orders for customer:', finalCustomerId);
        
        // Construct the URL with customer ID and shop
        const apiUrl = `/apps/draft-order/list?logged_in_customer_id=${finalCustomerId}&shop=${shopDomain}`;
        console.log('[Theme Extension] App proxy URL:', apiUrl);
        
        // Add debug info to document
        const debugInfo = document.createElement('div');
        debugInfo.style.display = 'none';
        debugInfo.className = 'debug-info';
        debugInfo.innerHTML = `
          <p><strong>Debug Info:</strong></p>
          <p>URL: ${window.location.href}</p>
          <p>Search params: ${window.location.search}</p>
          <p>Customer ID from URL: ${customerId}</p>
          <p>Customer ID from meta: ${customerIdFromPage}</p>
          <p>Using customer ID: ${finalCustomerId}</p>
          <p>Shop: ${shopDomain}</p>
        `;
        containerDiv.appendChild(debugInfo);
        
        // Fetch draft orders
        fetch(apiUrl)
          .then(response => {
            console.log(`[Theme Extension] App proxy response status: ${response.status}`);
            
            // Log the response headers
            const headers = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });
            console.log('[Theme Extension] Response headers:', headers);
            
            // Get the raw text first to debug any issues
            return response.text().then(text => {
              console.log('[Theme Extension] Raw response text:', text);
              try {
                // Try to parse the response as JSON
                return JSON.parse(text);
              } catch (error) {
                console.error('[Theme Extension] Failed to parse response as JSON:', error);
                throw new Error('Server returned an invalid JSON response. See console for details.');
              }
            });
          })
          .then(data => {
            console.log('[Theme Extension] Response from app proxy:', data);
            
            if (data.success) {
              renderDraftOrders(data.draftOrders);
            } else {
              errorDiv.innerHTML = `<div class="error-message">Error: ${data.error || 'Unknown error'}</div>`;
              loadingDiv.style.display = 'none';
              errorDiv.style.display = 'block';
            }
          })
          .catch(error => {
            console.error('[Theme Extension] Error in app proxy request:', error);
            errorDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
          });
      }
      
      // Add click event to refresh button
      refreshBtn.addEventListener('click', fetchDraftOrders);
      
      
      // Check if we have alternate way to get customer ID from Shopify object
      if (window.Shopify && window.Shopify.customer) {
        console.log('[Theme Extension] Found Shopify.customer object:', window.Shopify.customer);
      }
      
      // Fetch draft orders immediately
      fetchDraftOrders();
    });
  })();