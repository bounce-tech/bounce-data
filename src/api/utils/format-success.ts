const formatSuccess = (data: any) => {
  return {
    status: "success",
    data: data,
    error: null,
  };
};

export default formatSuccess;
