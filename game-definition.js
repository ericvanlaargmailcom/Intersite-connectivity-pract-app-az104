export const gameDefinition = {
  title: "AZ-104 Intersite Connectivity Placement",
  subtitle: "Place the Azure networking services in the design where they belong.",
  services: [
    {
      id: "s2s-vpn",
      name: "Site-to-site VPN",
      shortName: "S2S VPN",
      icon: "S2S",
      iconPath: "/assets/icons/s2s-vpn.svg",
      description: "Encrypted IPsec tunnel between on-premises and Azure."
    },
    {
      id: "expressroute",
      name: "ExpressRoute",
      shortName: "ExpressRoute",
      icon: "ER",
      iconPath: "/assets/icons/expressroute.svg",
      description: "Private connectivity from on-premises to Microsoft cloud."
    },
    {
      id: "p2s-vpn",
      name: "Point-to-site VPN",
      shortName: "P2S VPN",
      icon: "P2S",
      iconPath: "/assets/icons/p2s-vpn.svg",
      description: "User device VPN connection into Azure."
    },
    {
      id: "azure-firewall",
      name: "Azure Firewall",
      shortName: "Firewall",
      icon: "FW",
      iconPath: "/assets/icons/azure-firewall.svg",
      description: "Central network security and filtering in the hub."
    },
    {
      id: "vpn-gateway",
      name: "VPN Gateway",
      shortName: "VPN Gateway",
      icon: "GW",
      iconPath: "/assets/icons/vpn-gateway.svg",
      description: "Azure gateway resource that terminates VPN connections."
    },
    {
      id: "expressroute-gateway",
      name: "ExpressRoute Gateway",
      shortName: "ER Gateway",
      icon: "ERG",
      iconPath: "/assets/icons/vpn-gateway.svg",
      description: "Virtual network gateway used to connect Azure VNets to ExpressRoute circuits."
    },
    {
      id: "service-endpoint",
      name: "Service Endpoint",
      shortName: "Service Endpoint",
      icon: "SE",
      iconPath: "/assets/icons/service-endpoint.svg",
      description: "Extends VNet identity to supported Azure platform services."
    },
    {
      id: "private-endpoint",
      name: "Private Endpoint",
      shortName: "Private Endpoint",
      icon: "PE",
      iconPath: "/assets/icons/private-endpoint.svg",
      description: "Private IP in your VNet for a specific Azure PaaS resource."
    },
    {
      id: "vnet-peering",
      name: "VNet Peering",
      shortName: "Peering",
      icon: "VP",
      iconPath: "/assets/icons/vnet-peering.svg",
      description: "Connects virtual networks over the Azure backbone."
    },
    {
      id: "azure-load-balancer",
      name: "Azure Load Balancer",
      shortName: "Load Balancer",
      icon: "LB",
      iconPath: "/assets/icons/azure-load-balancer.svg",
      description: "Layer 4 load distribution for VMs or internal services."
    },
    {
      id: "application-gateway",
      name: "Azure Application Gateway",
      shortName: "App Gateway",
      icon: "AG",
      iconPath: "/assets/icons/application-gateway.svg",
      description: "Layer 7 HTTP(S) load balancing and routing."
    },
    {
      id: "nat",
      name: "NAT",
      shortName: "NAT",
      icon: "NAT",
      iconPath: "/assets/icons/nat.svg",
      description: "Distractor: not used in this target design.",
      distractor: true
    }
  ],
  slots: [
    {
      id: "remote-access",
      label: "Remote user access",
      hint: "Individual admin laptop into Azure",
      correctServiceId: "p2s-vpn",
      x: 12,
      y: 16
    },
    {
      id: "s2s-link",
      label: "On-premises encrypted tunnel",
      hint: "Branch/datacenter to Azure over public internet",
      correctServiceId: "s2s-vpn",
      x: 24,
      y: 41
    },
    {
      id: "private-circuit",
      label: "Private WAN circuit",
      hint: "Dedicated carrier/private connectivity",
      correctServiceId: "expressroute",
      x: 24,
      y: 76
    },
    {
      id: "hub-gateway",
      label: "VPN gateway subnet",
      hint: "Terminates VPN connectivity in Azure",
      correctServiceId: "vpn-gateway",
      x: 42,
      y: 53
    },
    {
      id: "expressroute-gateway",
      label: "ExpressRoute gateway subnet",
      hint: "Connects the hub VNet to the private circuit",
      correctServiceId: "expressroute-gateway",
      x: 42,
      y: 65
    },
    {
      id: "hub-security",
      label: "Central hub inspection",
      hint: "North-south and east-west traffic filtering",
      correctServiceId: "azure-firewall",
      x: 56,
      y: 38
    },
    {
      id: "hub-spoke-connection",
      label: "Hub to spoke connection",
      hint: "Azure backbone VNet-to-VNet connectivity",
      correctServiceId: "vnet-peering",
      x: 69,
      y: 50
    },
    {
      id: "public-web-entry",
      label: "Public web entry",
      hint: "HTTP(S), WAF-ready, path-based routing",
      correctServiceId: "application-gateway",
      x: 86,
      y: 17
    },
    {
      id: "vm-distribution",
      label: "VM traffic distribution",
      hint: "Layer 4 balancing to compute instances",
      correctServiceId: "azure-load-balancer",
      x: 86,
      y: 43
    },
    {
      id: "paas-public-path",
      label: "PaaS via Azure backbone",
      hint: "Subnet reaches supported service",
      correctServiceId: "service-endpoint",
      x: 72,
      y: 79
    },
    {
      id: "paas-private-ip",
      label: "PaaS private IP",
      hint: "NIC inside the VNet",
      correctServiceId: "private-endpoint",
      x: 91,
      y: 79
    }
  ]
};

export function getPublicGameDefinition() {
  return {
    title: gameDefinition.title,
    subtitle: gameDefinition.subtitle,
    services: gameDefinition.services,
    slots: gameDefinition.slots.map(({ correctServiceId, ...slot }) => slot)
  };
}

export function getSolution() {
  return Object.fromEntries(
    gameDefinition.slots.map((slot) => [slot.id, slot.correctServiceId])
  );
}
