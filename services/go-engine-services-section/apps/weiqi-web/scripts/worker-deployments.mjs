/** Select Cloudflare's most recent fully-active deployment, not its list head. */
export function activeWorkerVersion(deployments) {
  if (!Array.isArray(deployments)) throw new TypeError("Cloudflare deployments must be an array");
  const activeDeployment = deployments
    .filter((deployment) => typeof deployment?.created_on === "string" && Number.isFinite(Date.parse(deployment.created_on)))
    .toSorted((left, right) => Date.parse(right.created_on) - Date.parse(left.created_on))
    .find((deployment) => deployment.versions?.some(({ percentage }) => percentage === 100));
  const version = activeDeployment?.versions?.find(({ percentage }) => percentage === 100)?.version_id;
  if (typeof version !== "string" || !version) throw new Error("Cloudflare did not report an active Worker version");
  return version;
}
