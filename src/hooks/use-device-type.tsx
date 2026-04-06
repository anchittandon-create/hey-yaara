import * as React from "react";

export type DeviceType = "mobile" | "tablet" | "desktop";

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

const getDeviceType = (width: number): DeviceType => {
  if (width <= MOBILE_MAX) {
    return "mobile";
  }

  if (width <= TABLET_MAX) {
    return "tablet";
  }

  return "desktop";
};

export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<DeviceType>("mobile");

  React.useEffect(() => {
    const updateDeviceType = () => {
      setDeviceType(getDeviceType(window.innerWidth));
    };

    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);

    return () => window.removeEventListener("resize", updateDeviceType);
  }, []);

  return deviceType;
}
