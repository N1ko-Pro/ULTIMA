const toErrorResponse = (error) => ({
  success: false,
  error: error?.message || String(error),
});

const wrapHandler = (handler) => async (...args) => {
  try {
    return await handler(...args);
  } catch (error) {
    return toErrorResponse(error);
  }
};

module.exports = { wrapHandler };
