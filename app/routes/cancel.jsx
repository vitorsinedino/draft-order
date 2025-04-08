// app/routes/cancel.jsx

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("[CANCEL] Request received:", request.url);
  console.log("[CANCEL] Request method:", request.method);
  
  try {
    // Get query parameters from the URL
    const url = new URL(request.url);
    const shopParam = url.searchParams.get('shop');
    
    // Get request body
    const body = await request.text();
    console.log("[CANCEL] Request body:", body);
    
    try {
      const jsonBody = JSON.parse(body);
      const { orderId } = jsonBody;
      
      if (!orderId) {
        console.error("[CANCEL] No order ID provided");
        return json({ 
          success: false, 
          error: "Order ID is required" 
        }, { status: 400 });
      }
      
      console.log("[CANCEL] Attempting to cancel draft order:", orderId);
      
      // Authenticate as admin to delete the draft order
      console.log("[CANCEL] Authenticating...");
      const { admin } = await authenticate.public.appProxy(request);
      console.log("[CANCEL] Authentication successful");
      
      // Execute the GraphQL mutation to delete the draft order
      console.log("[CANCEL] Sending delete mutation for order ID:", orderId);
      const response = await admin.graphql(
        `#graphql
        mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
          draftOrderDelete(input: $input) {
            deletedId
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: {
              id: orderId
            }
          },
        },
      );
      
      const data = await response.json();
      console.log("[CANCEL] GraphQL response:", JSON.stringify(data));
      
      // Check for errors
      if (data.errors) {
        console.error("[CANCEL] GraphQL errors:", JSON.stringify(data.errors));
        return json({
          success: false,
          error: data.errors[0].message
        }, { status: 500 });
      }
      
      if (data.data?.draftOrderDelete?.userErrors?.length > 0) {
        console.error("[CANCEL] User errors:", JSON.stringify(data.data.draftOrderDelete.userErrors));
        return json({
          success: false,
          error: data.data.draftOrderDelete.userErrors[0].message
        });
      }
      
      console.log("[CANCEL] Draft order cancelled successfully");
      return json({
        success: true,
        deletedId: data.data.draftOrderDelete.deletedId
      });
      
    } catch (parseError) {
      console.error("[CANCEL] JSON parse error:", parseError);
      return json({ 
        success: false, 
        error: "Invalid JSON request" 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("[CANCEL] Error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};

// Handle GET requests for sanity checking
export const loader = ({ request }) => {
  console.log("[CANCEL LOADER] Request received:", request.url);
  return json({ 
    success: true, 
    message: "Draft order cancel endpoint is working" 
  });
};