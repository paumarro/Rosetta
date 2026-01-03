import AppLayout from '@/layouts/AppLayout';

import { cn, buildEditorUrl } from '@shared/utils';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SearchSkillForm } from '@/components/learning-paths/SearchSkillForm';
import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useParams } from 'react-router-dom';

const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;
const DEV_EDITOR_FE_URL = import.meta.env.VITE_DEV_EDITOR_FE_URL as string;

export default function CreateLearningPath({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { communityname } = useParams<{ communityname?: string }>();
  const [pathName, setPathName] = useState<string>('');
  const [pathNameCharacterCount, setPathNameCharacterCount] =
    useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const handleSearchSubmit = (value: string) => {
    if (value.trim() && !skills.includes(value.trim())) {
      setSkills([...skills, value.trim()]);
      setSearchValue(''); //Clear the input after adding
    }
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate community is present
    if (!communityname) {
      setErrorMessage(
        'No community specified. Please navigate from a community page.',
      );
      return;
    }

    const formData = {
      pathName: pathName,
      description: description,
      skills: skills,
    };

    // Use new community-scoped endpoint
    const LP_API_URL = `${BE_API_URL}/api/communities/${encodeURIComponent(communityname)}/learning-paths`;

    try {
      const response = await fetch(LP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      // Handle specific error statuses
      if (response.status === 403) {
        const errorData = (await response.json()) as { error?: string };
        setErrorMessage(
          errorData.error ||
            'You do not have permission to create learning paths for this community.',
        );
        return;
      }

      if (response.status === 409 || response.status === 500) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const errorMsg =
          errorData.error ||
          'A learning path with this name already exists. Please choose a different name.';
        setErrorMessage(errorMsg);
        return;
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrorMessage(
          errorData.error ||
            `An error occurred while creating the learning path. (Status: ${response.status.toString()})`,
        );
        return;
      }

      const created = (await response.json().catch(() => ({}))) as {
        ID?: string;
        id?: string;
        learningPathId?: string;
      };
      const resolvedId =
        created.learningPathId || created.ID || created.id || pathName;

      // Include community in editor URL using canonical ID when available
      window.location.href = buildEditorUrl(
        DEV_EDITOR_FE_URL,
        communityname,
        resolvedId,
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error submitting form:', err.message);
        setErrorMessage(err.message);
      } else {
        console.error('Unknown error submitting form:', err);
        setErrorMessage('An error occurred while creating the learning path.');
      }
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col items-center justify-center ">
        <div className="">
          <div className={cn('flex flex-col ', className)} {...props}>
            <Card>
              <CardHeader className="min-w-sm justify-center">
                <CardTitle className="text-2xl mt-5 text-center">
                  Create a Learning Path
                </CardTitle>
                <CardDescription>
                  Share your experience, empower the community
                </CardDescription>
                {communityname && (
                  <div className="flex justify-center mt-4">
                    <Badge variant="secondary" className="text-sm">
                      {decodeURIComponent(communityname)}
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="min-w-md mx-5 my-2">
                {errorMessage && (
                  <div className="rounded-md bg-destructive/15 p-3 ">
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    void handleSubmit(e);
                  }}
                >
                  <div className="grid gap-6 mt-10">
                    <div className="grid gap-3">
                      <Label htmlFor="path-name">Learning Path Name</Label>

                      <Input
                        id="path-name"
                        type="text"
                        placeholder="Add a short name..."
                        required
                        value={pathName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPathName(value);
                          setPathNameCharacterCount(value.length);
                        }}
                        maxLength={50}
                        className="border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2"
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {pathNameCharacterCount}/50
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="description">Description</Label>

                      <Textarea
                        id="description"
                        placeholder="Add a short description..."
                        required
                        value={description}
                        onChange={(
                          e: React.ChangeEvent<HTMLTextAreaElement>,
                        ) => {
                          setDescription(e.target.value);
                        }}
                        rows={4}
                        className="resize-none border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2"
                      />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="skills">Skills</Label>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-6">
                        <div className="grid gap-3">
                          <SearchSkillForm
                            className="w-full"
                            inputValue={searchValue}
                            onInputChange={setSearchValue}
                            onSearch={handleSearchSubmit}
                            placeholder="I.e.: Scrum, HTML, Branding..."
                            inputClassName="border-0 border-b rounded-none pl-7 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                      <span className="bg-card text-muted-foreground relative z-10 px-2">
                        Your skills
                      </span>
                    </div>

                    {/* Selected skills */}
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {skills.length > 0 ? (
                          skills.map((skill, index) => (
                            <div
                              key={index}
                              className="relative group inline-block"
                            >
                              <Badge
                                key={index}
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => {
                                  //Remove skill when clicked
                                  setSkills(skills.filter((s) => s !== skill));
                                }}
                                title="Click to remove"
                              >
                                {skill}
                                <span className="absolute rounded-full bg-background text-muted-foreground border border-border w-4 h-4 flex items-center justify-center -right-1 -top-1  opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="size-2" />
                                </span>
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No skills added yet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-6">
                      <Button type="submit" className="w-full">
                        Start Building <ChevronRight />
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
