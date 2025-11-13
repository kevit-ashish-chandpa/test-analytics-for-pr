type Label = {
  name?: string | null;
};

export const checkRevert = (
  branch?: string | null,
  labels?: Label[] | null
) => {
  const branchIsRevert =
    typeof branch === "string" ? /^revert-\d+/i.test(branch) : false;
  const labelIsRevert = Array.isArray(labels)
    ? labels.some((label) =>
        typeof label?.name === "string"
          ? /^revert\b/i.test(label.name)
          : false
      )
    : false;
  return branchIsRevert || labelIsRevert;
};
