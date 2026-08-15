export type AnimalReactionDisplayState = {
  canDisplayPose: boolean;
  shouldPreloadPose: boolean;
};

export function getAnimalReactionDisplayState(
  poseKey: string | null,
  loadedPoseKey: string | null,
  failedPoseKey: string | null
): AnimalReactionDisplayState {
  if (!poseKey || failedPoseKey === poseKey) {
    return { canDisplayPose: false, shouldPreloadPose: false };
  }

  const canDisplayPose = loadedPoseKey === poseKey;
  return {
    canDisplayPose,
    shouldPreloadPose: !canDisplayPose,
  };
}
