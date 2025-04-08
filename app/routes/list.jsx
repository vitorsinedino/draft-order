// app/routes/list.jsx

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("[LIST] Request received:", request.url);
  console.log("[LIST] Request method:", request.method);
  console.log("[LIST] Request headers:", Object.fromEntries([...request.headers.entries()]));
  
  try {
    // Get query parameters from the URL
    const url = new URL(request.url);
    const customerId = url.searchParams.get('logged_in_customer_id');
    const shop = url.searchParams.get('shop');
    
    console.log("[LIST] All URL params:", Object.fromEntries(url.searchParams.entries()));
    console.log("[LIST] Shop:", shop);
    console.log("[LIST] Customer ID from URL:", customerId);
    
    // Authenticate the app proxy request
    console.log("[LIST] Authenticating...");
    const { admin } = await authenticate.public.appProxy(request);
    console.log("[LIST] Authentication successful");
    
    // If no customer ID is provided, return an error
    if (!customerId) {
      console.log("[LIST] No customer ID provided");
      return json({
        success: false,
        error: "Customer ID is required"
      }, { status: 400 });
    }
    
    // Fetch draft orders for the customer
    console.log("[LIST] Fetching draft orders for customer:", customerId);
    
    const query = `customerId:${customerId}`;
    const response = await admin.graphql(
      `#graphql
      query getDraftOrders($query: String!) {
        draftOrders(first: 20, query: $query) {
          edges {
            node {
              id
              name
              status
              totalPrice
              createdAt
              customer {
                firstName
                lastName
                email
              }
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                    variant {
                      title
                      product {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          query: query
        }
      }
    );
    
    const data = await response.json();
    console.log("[LIST] GraphQL response:", JSON.stringify(data));
    
    // Check for errors
    if (data.errors) {
      console.error("[LIST] GraphQL errors:", JSON.stringify(data.errors));
      return json({
        success: false,
        error: data.errors[0].message
      }, { status: 500 });
    }
    
    // Process and format draft orders
    const draftOrders = data.data.draftOrders.edges.map(edge => {
      const node = edge.node;
      
      // Format line items
      const lineItems = node.lineItems.edges.map(lineItem => ({
        title: lineItem.node.title,
        quantity: lineItem.node.quantity,
        variantTitle: lineItem.node.variant?.title,
        productTitle: lineItem.node.variant?.product?.title
      }));
      
      return {
        id: node.id,
        name: node.name,
        status: node.status,
        totalPrice: node.totalPrice,
        createdAt: node.createdAt,
        customer: node.customer ? {
          firstName: node.customer.firstName,
          lastName: node.customer.lastName,
          email: node.customer.email
        } : null,
        lineItems: lineItems
      };
    });
    
    console.log("[LIST] Returning draft orders data");
    return json({
      success: true,
      draftOrders: draftOrders
    });
    
  } catch (error) {
    console.error("[LIST] Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

// Also handle GET requests
export const loader = async ({ request }) => {
  console.log("[LIST LOADER] Request received:", request.url);
  console.log("[LIST LOADER] Request method:", request.method);
  console.log("[LIST LOADER] Request headers:", Object.fromEntries([...request.headers.entries()]));
  
  try {
    // Get query parameters from the URL
    const url = new URL(request.url);
    const customerId = url.searchParams.get('logged_in_customer_id');
    const shop = url.searchParams.get('shop');
    const allParams = Object.fromEntries(url.searchParams.entries());
    
    console.log("[LIST LOADER] All URL params:", allParams);
    console.log("[LIST LOADER] Shop:", shop);
    console.log("[LIST LOADER] Customer ID from URL:", customerId);
    
    // Check for alternative customer ID params
    const possibleCustomerIdParams = ['customer_id', 'customerId', 'customer'];
    let detectedCustomerId = customerId;
    
    for (const param of possibleCustomerIdParams) {
      const value = url.searchParams.get(param);
      if (value && !detectedCustomerId) {
        console.log(`[LIST LOADER] Found alternative customer ID in '${param}' param:`, value);
        detectedCustomerId = value;
      }
    }
    
    // Check cookies for customer information
    const cookies = request.headers.get('cookie');
    console.log("[LIST LOADER] Cookies:", cookies || 'none');
    
    // If no customer ID is provided in GET request, return a debug response
    if (!detectedCustomerId) {
      return json({ 
        success: false, 
        debug: true,
        message: "Draft order list endpoint is working but no customer ID was found.",
        params: allParams,
        headers: Object.fromEntries([...request.headers.entries()]),
        cookies: cookies || 'none'
      });
    }
    
    console.log("[LIST LOADER] Using detected customer ID:", detectedCustomerId);
    
    // Use the detected customer ID
    const modifiedRequest = new Request(request);
    const modifiedUrl = new URL(request.url);
    modifiedUrl.searchParams.set('logged_in_customer_id', detectedCustomerId);
    Object.defineProperty(modifiedRequest, 'url', {
      value: modifiedUrl.toString()
    });
    
    // Otherwise, handle it like a POST request to fetch draft orders
    return await action({ request: modifiedRequest });
    
  } catch (error) {
    console.error("[LIST LOADER] Error:", error);
    return json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
};