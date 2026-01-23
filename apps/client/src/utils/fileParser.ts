
export const parseTopologyFile = (content: string, fileName: string): { devices: any[], edges: any[] } => {
  let devices: any[] = [];
  let edges: any[] = [];

  // Helper to safely evaluate JS object strings
  const safeEval = (str: string) => {
    try {
      // Loose JSON parsing (handles single quotes, unquoted keys)
      return new Function('return ' + str)();
    } catch (e) {
      return null;
    }
  };

  console.log(`Parsing file: ${fileName} (${content.length} bytes)`);

  // STRATEGY 1: Look for Vis.js "nodes.add([...])" or "edges.add([...])"
  // Regex: matches .add( [ ... ] ) pattern, capturing the array content
  // We make it case insensitive and flexible with whitespace
  const addPattern = /.adds*(s*([[sS]*?])s*)/g;
  
  let match;
  while ((match = addPattern.exec(content)) !== null) {
    const arrayStr = match[1];
    const data = safeEval(arrayStr);
    
    if (Array.isArray(data) && data.length > 0) {
      // Feature Detection
      const sample = data[0];
      
      // Is it a Device? (Has 'mac' OR 'label' that looks like an ID)
      if (sample.mac || (sample.id && sample.label)) {
         console.log(`Found Device Block: ${data.length} items`);
         devices.push(...data);
      } 
      // Is it an Edge? (Has 'from' AND 'to')
      else if (sample.from !== undefined && sample.to !== undefined) {
         console.log(`Found Edge Block: ${data.length} items`);
         edges.push(...data);
      }
    }
  }

  // STRATEGY 2: Look for variable assignments "var nodes = [...]"
  // Often used in raw data dumps
  const varPattern = /(?:var|const|let|window.)s*(w+)s*=s*([[sS]*?]);/g;
  while ((match = varPattern.exec(content)) !== null) {
      const arrayStr = match[2];
      const data = safeEval(arrayStr);
      if (Array.isArray(data) && data.length > 0) {
          const sample = data[0];
          if (sample.mac) devices.push(...data);
          else if (sample.from && sample.to) edges.push(...data);
      }
  }

  // STRATEGY 3: Fallback - Object Mining (Line by Line)
  // If bulk arrays failed, try to find individual objects like {id: 1, label: '...'}
  if (devices.length === 0) {
      console.log("Bulk parsing failed, trying Object Mining...");
      const objectRegex = /{[^{}]*?mac[^{}]*?}/g; // Objects with 'mac'
      while ((match = objectRegex.exec(content)) !== null) {
          const obj = safeEval(match[0]);
          if (obj) devices.push(obj);
      }
  }
  
  if (edges.length === 0) {
      const edgeRegex = /{[^{}]*?from[^{}]*?to[^{}]*?}/g; // Objects with 'from' and 'to'
      while ((match = edgeRegex.exec(content)) !== null) {
          const obj = safeEval(match[0]);
          if (obj) edges.push(obj);
      }
  }

  // Deduplicate Devices (keep last occurrence)
  const uniqueDevices = Array.from(new Map(devices.map(d => [d.mac || d.id, d])).values());

  // Normalization
  // Ensure every device has a 'mac' property if it only had 'id'
  const normalizedDevices = uniqueDevices.map(d => ({
      ...d,
      mac: d.mac || String(d.id), // Fallback ID as MAC
      label: d.label || d.title || String(d.id)
  }));

  console.log(`Parse Result: ${normalizedDevices.length} devices, ${edges.length} edges`);
  
  return { devices: normalizedDevices, edges };
};
