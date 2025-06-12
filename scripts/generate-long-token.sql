-- Generate a token with 1 year expiration
DEFINE TOKEN api_token ON DATABASE TYPE HS512 VALUE "ssc_chatbot_secret_key" DURATION 8760h;
