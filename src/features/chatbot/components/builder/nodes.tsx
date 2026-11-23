/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Handle, Position } from "reactflow";

/* -----------------------------------------------------
   ✅ Shared Node Card UI
----------------------------------------------------- */
export function Card({
  title,
  children,
  gradient,
  icon,
}: {
  title: string;
  children?: React.ReactNode;
  gradient: string;
  icon: string;
}) {
  return (
    <div className="builder-node-card">
      <div className={`builder-node-card-header ${gradient}`}>
        <span>{icon}</span>
        <div className="builder-node-card-title">{title}</div>
      </div>
      <div className="builder-node-card-body">{children}</div>
    </div>
  );
}

/* -----------------------------------------------------
   ✅ TRIGGER NODE
----------------------------------------------------- */
export const TriggerNode = ({ data }: any) => (
  <div>
    <Card 
      title="Trigger" 
      gradient="gradient-purple-indigo"
      icon="⚡"
    >
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--color-text-muted)',
        background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem'
      }}>
        {data?.label || "On Message"}
      </div>
    </Card>

    <Handle 
      type="source" 
      position={Position.Right} 
      id="out"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--neutral-900)',
        border: '2px solid white'
      }}
    />
  </div>
);

/* -----------------------------------------------------
   ✅ MESSAGE NODE (with Image Upload Support)
----------------------------------------------------- */
export const MessageNode = ({ data }: any) => {
  const images = Array.isArray(data?.images) ? data.images : [];
  
  return (
    <div>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="in"
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--neutral-900)',
          border: '2px solid white'
        }}
      />

      <Card 
        title="Message" 
        gradient="gradient-blue-cyan"
        icon="💬"
      >
        <div style={{
          background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.5rem'
        }}>
          {/* Text Message */}
          <p style={{ fontSize: '0.875rem', lineHeight: '1.5', margin: 0, marginBottom: images.length > 0 ? '0.5rem' : 0 }}>
            {data?.text || "Hello 👋"}
          </p>

          {/* Images Display */}
          {images.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginTop: '0.5rem'
            }}>
              {images.map((img: any, i: number) => (
                <div key={i} style={{
                  background: 'color-mix(in oklab, var(--color-text) 5%, transparent)',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid color-mix(in oklab, var(--color-text) 12%, transparent)'
                }}>
                  {img.url ? (
                    <div style={{
                      width: '100%',
                      height: '80px',
                      borderRadius: '0.25rem',
                      overflow: 'hidden',
                      background: 'var(--color-surface-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: img.caption ? '0.375rem' : 0
                    }}>
                      <img 
                        src={img.url} 
                        alt="Preview" 
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          if ((e.target as HTMLElement).parentElement) {
                            (e.target as HTMLElement).parentElement!.innerHTML = '<span style="color: var(--color-text-muted); font-size: 0.6875rem;">Invalid URL</span>';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '80px',
                      borderRadius: '0.25rem',
                      background: 'var(--color-surface-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed var(--color-border-strong)',
                      marginBottom: img.caption ? '0.375rem' : 0
                    }}>
                      <span style={{ fontSize: '1.75rem', opacity: 0.5 }}>🖼️</span>
                    </div>
                  )}
                  {img.caption && (
                    <p style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                      margin: 0,
                      lineHeight: '1.4'
                    }}>
                      {img.caption}
                    </p>
                  )}
                </div>
              ))}
              {images.length > 1 && (
                <div style={{
                  fontSize: '0.625rem',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '0.25rem',
                  background: 'color-mix(in oklab, var(--color-text) 6%, transparent)',
                  borderRadius: '0.25rem'
                }}>
                  {images.length} Images
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="out"
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--neutral-900)',
          border: '2px solid white'
        }}
      />
    </div>
  );
};

/* -----------------------------------------------------
   ✅ AI NODE
----------------------------------------------------- */
export const AINode = ({ data }: any) => (
  <div>
    <Handle 
      type="target" 
      position={Position.Left} 
      id="in"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--color-primary)',
        border: '2px solid white'
      }}
    />

    <Card 
      title="AI Response" 
      gradient="gradient-green-emerald"
      icon="🤖"
    >
      <div style={{
        background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem'
      }}>
        <p style={{
          fontSize: '0.75rem',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          lineHeight: '1.5',
          color: 'var(--color-text)',
          wordBreak: 'break-word',
          margin: 0
        }}>
          {data?.prompt || "AI Response"}
        </p>
      </div>
    </Card>

    <Handle 
      type="source" 
      position={Position.Right} 
      id="out"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--color-primary)',
        border: '2px solid white'
      }}
    />
  </div>
);

/* -----------------------------------------------------
   ✅ CONDITION NODE (TRUE / FALSE)
----------------------------------------------------- */
export const ConditionNode = ({ data }: any) => (
  <div>
    <Handle 
      type="target" 
      position={Position.Left} 
      id="in"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--color-warning)',
        border: '2px solid white'
      }}
    />

    <Card 
      title="Condition" 
      gradient="gradient-amber-orange"
      icon="🔀"
    >
      <div style={{
        background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        marginBottom: '0.5rem'
      }}>
        <code style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          wordBreak: 'break-word'
        }}>
          {data?.expr || `includes(text,"hi")`}
        </code>
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.625rem',
        marginTop: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '9999px',
            background: 'var(--color-primary)'
          }}></div>
          <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>TRUE</span>
        </div>
        <span style={{ color: 'var(--color-text-muted)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '9999px',
            background: 'var(--color-warning)'
          }}></div>
          <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>FALSE</span>
        </div>
      </div>
    </Card>

    <Handle
      type="source"
      position={Position.Right}
      id="true"
      style={{
        top: 32,
        width: '12px',
        height: '12px',
        background: 'var(--color-primary)',
        border: '2px solid white'
      }}
    />

    <Handle
      type="source"
      position={Position.Right}
      id="false"
      style={{
        top: 68,
        width: '12px',
        height: '12px',
        background: 'var(--color-warning)',
        border: '2px solid white'
      }}
    />
  </div>
);

/* -----------------------------------------------------
   ✅ HTTP ACTION NODE
----------------------------------------------------- */
export const ActionNode = ({ data }: any) => (
  <div>
    <Handle 
      type="target" 
      position={Position.Left} 
      id="in"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--neutral-900)',
        border: '2px solid white'
      }}
    />

    <Card 
      title="HTTP Request" 
      gradient="gradient-pink-rose"
      icon="🌐"
    >
      <div style={{
        background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            background: 'color-mix(in oklab, var(--color-text) 8%, transparent)',
            padding: '0.125rem 0.5rem',
            borderRadius: '0.25rem'
          }}>
            {data?.method || "POST"}
          </span>
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'DM Sans', system-ui, sans-serif"
        }}>
          {data?.url || "https://endpoint.com"}
        </div>
      </div>
    </Card>

    <Handle 
      type="source" 
      position={Position.Right} 
      id="out"
      style={{
        width: '12px',
        height: '12px',
        background: 'var(--neutral-900)',
        border: '2px solid white'
      }}
    />
  </div>
);

/* -----------------------------------------------------
 ✅ BUTTON MESSAGE NODE
----------------------------------------------------- */
export const ButtonMessageNode = ({ data }: any) => {
  const buttons: string[] = Array.isArray(data?.buttons)
    ? data.buttons
    : ["Option 1"];

  const baseY = 68;
  const gap = 32;

  return (
    <div>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="in"
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--neutral-900)',
          border: '2px solid white'
        }}
      />

      <Card 
        title="Button Message" 
        gradient="gradient-blue-purple"
        icon="🔘"
      >
        <div style={{
          background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', margin: 0 }}>
            {data?.text || "Choose an option:"}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {buttons.map((btn, i) => (
            <div
              key={i}
              style={{
                background: 'linear-gradient(to right, var(--neutral-900), var(--neutral-900))',
                color: 'white',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                textAlign: 'center',
                boxShadow: 'var(--elevation-sm)'
              }}
            >
              {btn}
            </div>
          ))}
        </div>
      </Card>

      {buttons.map((btn, i) => (
        <Handle
          key={i}
          id={`btn_${i}`}
          type="source"
          position={Position.Right}
          title={btn}
          style={{
            top: baseY + i * gap,
            width: '12px',
            height: '12px',
            background: 'var(--neutral-900)',
            border: '2px solid white'
          }}
        />
      ))}
    </div>
  );
};

/* -----------------------------------------------------
   ✅ IMAGE NODE (with Multiple Images Support)
----------------------------------------------------- */
export const ImageNode = ({ data }: any) => {
  const images = Array.isArray(data?.images) ? data.images : [{ url: "", caption: "" }];
  
  return (
    <div>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="in"
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--neutral-900)',
          border: '2px solid white'
        }}
      />

      <Card 
        title="Image" 
        gradient="gradient-purple-pink"
        icon="🖼️"
      >
        <div style={{
          background: 'color-mix(in oklab, var(--color-text) 4%, transparent)',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {images.map((img: any, i: number) => (
            <div key={i} style={{
              background: 'color-mix(in oklab, var(--color-text) 5%, transparent)',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid color-mix(in oklab, var(--color-text) 12%, transparent)'
            }}>
              {img.url ? (
                <div style={{
                  width: '100%',
                  height: '80px',
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  background: 'var(--color-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: img.caption ? '0.375rem' : 0
                }}>
                  <img 
                    src={img.url} 
                    alt="Preview" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      if ((e.target as HTMLElement).parentElement) {
                        (e.target as HTMLElement).parentElement!.innerHTML = '<span style="color: var(--color-text-muted); font-size: 0.6875rem;">Invalid URL</span>';
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: '80px',
                  borderRadius: '0.25rem',
                  background: 'var(--color-surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed var(--color-border-strong)',
                  marginBottom: img.caption ? '0.375rem' : 0
                }}>
                  <span style={{ fontSize: '1.75rem', opacity: 0.5 }}>🖼️</span>
                </div>
              )}
              {img.caption && (
                <p style={{
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-muted)',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {img.caption}
                </p>
              )}
            </div>
          ))}
          {images.length > 1 && (
            <div style={{
              fontSize: '0.625rem',
              color: 'var(--color-text)',
              fontWeight: 600,
              textAlign: 'center',
              padding: '0.25rem',
              background: 'color-mix(in oklab, var(--color-text) 6%, transparent)',
              borderRadius: '0.25rem'
            }}>
              {images.length} Images
            </div>
          )}
        </div>
      </Card>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="out"
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--color-primary)',
          border: '2px solid white'
        }}
      />
    </div>
  );
};

/* -----------------------------------------------------
   ✅ NODE MAP
----------------------------------------------------- */
export const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  ai: AINode,
  condition: ConditionNode,
  action: ActionNode,
  buttonMessage: ButtonMessageNode,
  image: ImageNode,
} as const;

/* -----------------------------------------------------
   ✅ CONNECTION RULES
----------------------------------------------------- */
export function canConnect(
  sourceType?: string,
  targetType?: string,
  sourceHandle?: string
) {
  if (!sourceType || !targetType) return false;

  if (targetType === "trigger") return false;

  if (sourceType === "condition") {
    if (!["true", "false"].includes(sourceHandle || "")) return false;
    return true;
  }

  if (sourceType === "buttonMessage") {
    if (!sourceHandle?.startsWith("btn_")) return false;
    return true;
  }

  return true;
}

/* -----------------------------------------------------
   ✅ DEFAULT NODE DATA
----------------------------------------------------- */
export function getDefaultData(type: string) {
  switch (type) {
    case "message": 
      return { text: "Hello!", images: [] };
    case "ai": 
      return { prompt: "Answer politely." };
    case "condition": 
      return { expr: `includes(text,"hi")` };
    case "action": 
      return { url: "https://example.com", method: "POST", body: "{}" };
    case "buttonMessage": 
      return { text: "Choose:", buttons: ["Option 1", "Option 2"] };
    case "image": 
      return { images: [{ url: "", caption: "" }] };
    case "trigger": 
      return { label: "on message" };
    default: 
      return {};
  }
}