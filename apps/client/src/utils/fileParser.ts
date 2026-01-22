
export const parseTopologyFile = (content: string, fileName: string): { devices: any[], edges: any[] } => {
  let devices: any[] = [];
  let edges: any[] = [];

  // Helper to clean and parse JSON-like strings
  const safeParse = (str: string) => {
    try {
        // Replace single quotes with double quotes for JSON compliance if needed, 
        // but Function constructor is safer for loose JS objects
        return new Function('return ' + str)();
    } catch (e) { return null; }
  };

  if (fileName.endsWith('.html') || fileName.endsWith('.txt')) {
    console.log("Parsing HTML/TXT...");

    // STRATEGY 1: Look for "var/const/let nodes/edges = [...]" blocks (Common in Vis.js/ECharts)
    const arrayBlockRegex = /(?:var|const|let|window.)s*(nodes|edges)s*=s*([[sS]*?]);/g;
    let match;
    while ((match = arrayBlockRegex.exec(content)) !== null) {
        const type = match[1]; // "nodes" or "edges"
        const arrayStr = match[2];
        const data = safeParse(arrayStr);
        if (Array.isArray(data)) {
            if (type === 'nodes') devices.push(...data);
            if (type === 'edges') edges.push(...data);
        }
    }

    // STRATEGY 2: Look for "dataset.add([...])" patterns
    const addMethodRegex = /.(?:nodes|edges).add(s*([[sS]*?])s*)/g;
    while ((match = addMethodRegex.exec(content)) !== null) {
        const arrayStr = match[1];
        const data = safeParse(arrayStr);
        if (Array.isArray(data)) {
            // Heuristic: check first item keys to decide type
            if (data.length > 0) {
                if (data[0].mac || data[0].label) devices.push(...data);
                else if (data[0].from && data[0].to) edges.push(...data);
            }
        }
    }

    // STRATEGY 3: Fallback - Object Mining (The previous method, kept as backup)
    if (devices.length === 0 && edges.length === 0) {
        const objectRegex = /{[sS]*?}/g; // More permissive regex
        while ((match = objectRegex.exec(content)) !== null) {
            const snippet = match[0];
            // Only try parsing if it looks relevant to avoid overhead
            if (!snippet.includes('mac') && !snippet.includes('from')) continue;
            
            const obj = safeParse(snippet);
            if (obj) {
                if (obj.mac || (obj.id && obj.label)) devices.push(obj);
                else if (obj.from !== undefined && obj.to !== undefined) edges.push(obj);
            }
        }
    }
  } else {
    // JSON Strategy
    try {
      const json = JSON.parse(content);
      devices = json.devices || json.nodes || [];
      edges = json.edges || json.links || [];
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }

  // Deduplicate based on ID/MAC
  const uniqueDevices = Array.from(new Map(devices.map(d => [d.mac || d.id, d])).values());
  
  console.log(`Parsed: ${uniqueDevices.length} devices, ${edges.length} edges`);
  return { devices: uniqueDevices, edges };
};
