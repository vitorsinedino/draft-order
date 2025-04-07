// app/routes/create.jsx

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("[CREATE] Request received:", request.url);
  
  try {
    // Get query parameters from the URL
    const url = new URL(request.url);
    const customerId = url.searchParams.get('logged_in_customer_id');
    const shop = url.searchParams.get('shop');
    
    console.log("[CREATE] Shop:", shop);
    console.log("[CREATE] Customer ID from URL:", customerId);
    
    // Get request body
    const body = await request.text();
    console.log("[CREATE] Request body:", body);
    
    try {
      const jsonBody = JSON.parse(body);
      const { cart } = jsonBody;
      
      console.log("[CREATE] Cart items:", cart.items?.length || 0);
      
      // Format line items
      const lineItems = cart.items.map(item => ({
        variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
        quantity: item.quantity,
      }));
      
      // Authenticate the app proxy request
      console.log("[CREATE] Authenticating...");
      const { admin } = await authenticate.public.appProxy(request);
      console.log("[CREATE] Authentication successful");
      
      // Get customer data if customerId exists
      let customerData = null;
      let customerEmail = "customer@example.com";
      let shippingAddress = {
        address1: "123 Shopify St",
        city: "Toronto",
        province: "Ontario",
        country: "Canada",
        zip: "A1A 1A1",
        firstName: "Test",
        lastName: "Customer"
      };
      
      if (customerId) {
        console.log("[CREATE] Fetching customer data...");
        const customerResponse = await admin.graphql(
          `#graphql
          query getCustomer($customerId: ID!) {
            customer(id: $customerId) {
              id
              email
              firstName
              lastName
              phone
              defaultAddress {
                address1
                address2
                city
                province
                country
                zip
                firstName
                lastName
                phone
              }
            }
          }`,
          {
            variables: {
              customerId: `gid://shopify/Customer/${customerId}`
            }
          }
        );
        
        const customerResult = await customerResponse.json();
        console.log("[CREATE] Customer data response:", JSON.stringify(customerResult));
        
        if (customerResult.data?.customer) {
          customerData = customerResult.data.customer;
          customerEmail = customerData.email;
          
          // Use customer's default address if available
          if (customerData.defaultAddress) {
            const addr = customerData.defaultAddress;
            shippingAddress = {
              address1: addr.address1 || "123 Shopify St",
              address2: addr.address2,
              city: addr.city || "Toronto",
              province: addr.province || "Ontario",
              country: addr.country || "Canada",
              zip: addr.zip || "A1A 1A1",
              firstName: addr.firstName || customerData.firstName || "Test",
              lastName: addr.lastName || customerData.lastName || "Customer",
              phone: addr.phone || customerData.phone
            };
          } else {
            // If no default address, at least use the customer name
            shippingAddress.firstName = customerData.firstName || "Test";
            shippingAddress.lastName = customerData.lastName || "Customer";
            if (customerData.phone) {
              shippingAddress.phone = customerData.phone;
            }
          }
        }
      }
      
      // Create the draft order
      console.log("[CREATE] Creating draft order");
      const draftOrderInput = {
        // Use customer ID if available, otherwise just email
        ...(customerId ? { customerId: `gid://shopify/Customer/${customerId}` } : {}),
        email: customerEmail,
        note: "Created from cart via theme app extension",
        lineItems: lineItems,
        shippingAddress: shippingAddress,
        // Optionally copy shipping address to billing address
        billingAddress: shippingAddress
      };
      
      console.log("[CREATE] Draft order input:", JSON.stringify(draftOrderInput));
      
      const response = await admin.graphql(
        `#graphql
        mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
              customer {
                email
                firstName
                lastName
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: draftOrderInput
          },
        },
      );
      
      const data = await response.json();
      console.log("[CREATE] GraphQL response:", JSON.stringify(data));
      
      if (data.data?.draftOrderCreate?.userErrors?.length > 0) {
        console.error("[CREATE] User errors:", JSON.stringify(data.data.draftOrderCreate.userErrors));
        return json({
          success: false,
          error: data.data.draftOrderCreate.userErrors[0].message
        });
      }
      
      console.log("[CREATE] Draft order created successfully");
      return json({
        success: true,
        draftOrderId: data.data.draftOrderCreate.draftOrder.id,
        draftOrderName: data.data.draftOrderCreate.draftOrder.name,
        customerInfo: data.data.draftOrderCreate.draftOrder.customer
      });
    } catch (parseError) {
      console.error("[CREATE] JSON parse error:", parseError);
      return json({ success: false, error: "Invalid JSON request" }, { status: 400 });
    }
  } catch (error) {
    console.error("[CREATE] Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

// Also handle GET requests
export const loader = ({ request }) => {
  console.log("[CREATE LOADER] Request received:", request.url);
  return json({ 
    success: true, 
    message: "Draft order create endpoint is working" 
  });
};