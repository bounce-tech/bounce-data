const formatError = (error: string) => {
  return {
    status: "error",
    error: error,
    data: null,
  };
};

export default formatError;
