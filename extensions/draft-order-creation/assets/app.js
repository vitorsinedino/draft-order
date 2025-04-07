// /extensions/your-extension-name/assets/app.js

(function() {
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[Theme Extension] Initializing draft order creator');
      
      const createBtn = document.getElementById('create-draft-order-btn');
      const resultDiv = document.getElementById('draft-order-result');
      const shopDomain = document.getElementById('draft-order-creator').dataset.shop;
      
      if (!createBtn) {
        console.error('[Theme Extension] Button element not found');
        return;
      }
      
      console.log(`[Theme Extension] Setup complete for shop: ${shopDomain}`);
      
      createBtn.addEventListener('click', function() {
        console.log('[Theme Extension] Create button clicked');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        
        // Get cart data
        console.log('[Theme Extension] Fetching cart data');
        fetch('/cart.js')
          .then(response => {
            console.log(`[Theme Extension] Cart fetch response status: ${response.status}`);
            return response.json();
          })
          .then(cart => {
            console.log(`[Theme Extension] Cart data received: ${cart.item_count} items`);
            
            // Prepare data for API
            const requestData = {
              cart: cart,
              shop: shopDomain
            };
            
            console.log('[Theme Extension] App proxy URL:', `/apps/draft-order/create`);
            
            // Send to app proxy
            fetch('/apps/draft-order/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            })
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
                resultDiv.innerHTML = `<div class="success-message">Draft order created successfully! ID: ${data.draftOrderId}</div>`;
              } else {
                resultDiv.innerHTML = `<div class="error-message">Error: ${data.error || 'Unknown error'}</div>`;
              }
              resultDiv.style.display = 'block';
              createBtn.disabled = false;
              createBtn.textContent = 'Create Draft Order from Cart';
            })
            .catch(error => {
              console.error('[Theme Extension] Error in app proxy request:', error);
              resultDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
              resultDiv.style.display = 'block';
              createBtn.disabled = false;
              createBtn.textContent = 'Create Draft Order from Cart';
            });
          })
          .catch(error => {
            console.error('[Theme Extension] Error fetching cart:', error);
            resultDiv.innerHTML = `<div class="error-message">Error fetching cart: ${error.message}</div>`;
            resultDiv.style.display = 'block';
            createBtn.disabled = false;
            createBtn.textContent = 'Create Draft Order from Cart';
          });
      });
    });
  })();